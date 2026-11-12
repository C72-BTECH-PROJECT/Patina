"""Grading (R-08, D§6.2): cannot be steered by answer text, never silently zeroed.

- MCQ: deterministic, `response.strip().upper() == correct_option`. No LLM.
- Short answers: one batched Gemini call with the answers as untrusted data
  inside random per-call delimiters. The output is validated strictly: exactly
  one grade per answered short-answer question, no unknown or duplicate ids,
  points exactly 0, 0.5 or 1.
- Off-grid points (e.g. 0.73) are REJECTED, not snapped: a grader that does not
  follow the 0 / 0.5 / 1 rubric is treated as invalid output. A rejected round
  is retried once if time is left; otherwise the call fails.
- If short answers cannot be graded (LLM failure, timeout, invalid or
  incomplete output) the whole evaluation fails with GradingUnavailable
  (HTTP 502 grading_unavailable). No partial result, no 0 for ungraded work.
  A missing key raises LLMNotConfigured (HTTP 503) as in generation.
- Unanswered questions score 0 ("Not answered."): that is the candidate's
  result, not an infrastructure failure.
- Every result carries `candidate_feedback`, written by code from the outcome
  (never LLM text, never the correct option, ideal answer, key points or
  explanation), and `recruiter_feedback` with the full detail.
"""
import secrets
import time
from typing import Any

from pydantic import ValidationError

from app import config
from app.llm_client import AssessmentLLMError, LLMNotConfigured, generate_json
from app.prompts import (
    GRADING_PROMPT_VERSION,
    GRADING_SYSTEM_PROMPT,
    build_short_answer_evaluation_prompt,
)
from app.schemas import EvaluationResult, GraderOutput

# Whole-call bound for grading. Core allows 120 s for evaluate
# (backend/Services/assessmentService.js EVALUATE_TIMEOUT_MS); every LLM call is
# cut to the time left before this deadline, so grading ends within ~100 s.
GRADING_BUDGET_SECONDS = 100.0
MAX_GRADING_ROUNDS = 2
ALLOWED_POINTS = (0.0, 0.5, 1.0)

CANDIDATE_SHORT_FEEDBACK = {
    1.0: "Full credit: your answer covered the expected points.",
    0.5: "Partial credit: your answer covered some of the expected points.",
    0.0: "No credit: your answer did not cover the expected points.",
}
NOT_ANSWERED = "Not answered."


class GradingUnavailable(AssessmentLLMError):
    status_code = 502

    def __init__(self, message: str):
        super().__init__(message, code="grading_unavailable")


class EvaluateInputError(ValueError):
    """The questions, key and answers sent by core do not fit together."""


class GradeValidationError(ValueError):
    pass


def _mcq_result(question: dict, key_entry: dict, response_text: str) -> dict:
    correct_option = str(key_entry.get("correct_option", "")).strip().upper()
    response = str(response_text).strip().upper()
    is_correct = response == correct_option
    explanation = str(key_entry.get("explanation") or "").strip()
    return {
        "question_id": question["question_id"],
        "question_type": "mcq",
        "skill": question.get("skill", ""),
        "correct": is_correct,
        "points": 1.0 if is_correct else 0.0,
        "max_points": 1.0,
        "candidate_feedback": "Correct." if is_correct else "Incorrect.",
        "recruiter_feedback": (
            f"Correct answer: {correct_option}. Candidate chose: {response[:10]}. "
            f"{explanation}"
        ).strip(),
    }


def _unanswered(question: dict) -> dict:
    return {
        "question_id": question["question_id"],
        "question_type": question.get("question_type", "short_answer"),
        "skill": question.get("skill", ""),
        "correct": False,
        "points": 0.0,
        "max_points": 1.0,
        "candidate_feedback": NOT_ANSWERED,
        "recruiter_feedback": NOT_ANSWERED,
    }


def _validation_summary(exc: ValidationError) -> str:
    """Field paths and messages only, never the offending (LLM) input."""
    parts = []
    for error in exc.errors()[:5]:
        location = ".".join(str(part) for part in error.get("loc", ()))
        parts.append(f"{location}: {error.get('msg')}")
    return "; ".join(parts)


def validate_grades(payload: Any, expected_ids: list[str]) -> dict[str, dict]:
    """Strict check of the grader's output. Returns {question_id: grade}."""
    try:
        output = GraderOutput.model_validate(payload)
    except ValidationError as exc:
        raise GradeValidationError(
            f"grader output does not match the schema ({_validation_summary(exc)})"
        ) from exc

    grades: dict[str, dict] = {}
    for grade in output.grades:
        if grade.question_id in grades:
            raise GradeValidationError(f"duplicate grade for {grade.question_id}")
        points = float(grade.points)
        if points not in ALLOWED_POINTS:
            raise GradeValidationError(
                f"points {points:g} for {grade.question_id} is not 0, 0.5 or 1"
            )
        grades[grade.question_id] = {"points": points, "feedback": grade.feedback}

    expected = set(expected_ids)
    missing = sorted(expected - set(grades))
    unknown = sorted(set(grades) - expected)
    if missing or unknown:
        raise GradeValidationError(
            f"grades must cover exactly the answered short answers "
            f"(missing: {missing or 'none'}; unknown: {unknown or 'none'})"
        )
    return grades


def _grade_short_answers(items: list[dict]) -> tuple[dict[str, dict], str]:
    deadline = time.monotonic() + GRADING_BUDGET_SECONDS
    expected_ids = [item["question_id"] for item in items]
    problems: list[str] = []

    for round_number in range(1, MAX_GRADING_ROUNDS + 1):
        if round_number > 1 and deadline - time.monotonic() < config.MIN_CALL_SECONDS:
            problems.append("no time left in the grading budget for another round")
            break

        # A fresh random tag per call: the candidate cannot know it to close
        # their own block.
        tag = f"candidate_answer_{secrets.token_hex(8)}"
        prompt = build_short_answer_evaluation_prompt(items, tag)
        if problems:
            prompt += (
                "\n\nYOUR PREVIOUS RESPONSE WAS REJECTED: "
                + " | ".join(problems)
                + "\nReturn the complete grades object again."
            )

        try:
            payload, model_used = generate_json(
                prompt, system=GRADING_SYSTEM_PROMPT, deadline=deadline
            )
        except LLMNotConfigured:
            raise
        except AssessmentLLMError as exc:
            earlier = f" Earlier round: {' | '.join(problems)}." if problems else ""
            raise GradingUnavailable(
                f"Short-answer grading failed: {exc}{earlier}"
            ) from exc

        try:
            return validate_grades(payload, expected_ids), model_used
        except GradeValidationError as exc:
            problems.append(f"{model_used}: {exc}")

    raise GradingUnavailable(
        "Short-answer grading returned invalid output: " + " | ".join(problems)
    )


def evaluate_assessment(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Score a completed assessment. Returns a dict matching EvaluationResult.

    Raises EvaluateInputError (core sent inconsistent data), LLMNotConfigured
    or GradingUnavailable. Never returns a partial result.
    """
    assessment_id = payload["assessment_id"]
    questions = payload["questions"]
    answer_key = payload["answer_key"]
    answers = payload["answers"]

    question_ids = [q.get("question_id") for q in questions]
    if len(set(question_ids)) != len(question_ids) or not all(
        isinstance(qid, str) and qid for qid in question_ids
    ):
        raise EvaluateInputError("questions need unique, non-empty question_id values")
    keys_by_id = {k.get("question_id"): k for k in answer_key}
    answers_by_id = {a["question_id"]: a["response"] for a in answers}

    unknown_answers = sorted(set(answers_by_id) - set(question_ids))
    if unknown_answers:
        raise EvaluateInputError(f"answers for unknown questions: {unknown_answers}")

    short_items: list[dict] = []
    for question in questions:
        question_id = question["question_id"]
        key_entry = keys_by_id.get(question_id)
        question_type = question.get("question_type")
        if key_entry is None:
            raise EvaluateInputError(f"no answer key entry for {question_id}")
        if question_type == "mcq":
            if "correct_option" not in key_entry:
                raise EvaluateInputError(f"answer key for {question_id} has no correct_option")
        elif question_type == "short_answer":
            if "ideal_answer" not in key_entry or "key_points" not in key_entry:
                raise EvaluateInputError(
                    f"answer key for {question_id} needs ideal_answer and key_points"
                )
            if answers_by_id.get(question_id):
                short_items.append(
                    {
                        "question_id": question_id,
                        "question": question.get("question", ""),
                        "candidate_answer": answers_by_id[question_id],
                        "ideal_answer": key_entry.get("ideal_answer", ""),
                        "key_points": key_entry.get("key_points", []),
                    }
                )
        else:
            raise EvaluateInputError(
                f"question {question_id} has unknown type {question_type!r}"
            )

    grades: dict[str, dict] = {}
    grading_model = None
    if short_items:
        grades, grading_model = _grade_short_answers(short_items)

    results: list[dict[str, Any]] = []
    for question in questions:
        question_id = question["question_id"]
        answer = answers_by_id.get(question_id)
        if not answer:
            results.append(_unanswered(question))
        elif question["question_type"] == "mcq":
            results.append(_mcq_result(question, keys_by_id[question_id], answer))
        else:
            grade = grades[question_id]
            points = grade["points"]
            results.append(
                {
                    "question_id": question_id,
                    "question_type": "short_answer",
                    "skill": question.get("skill", ""),
                    "correct": points == 1.0,
                    "points": points,
                    "max_points": 1.0,
                    "candidate_feedback": CANDIDATE_SHORT_FEEDBACK[points],
                    "recruiter_feedback": f"{points:g}/1. {grade['feedback']}",
                }
            )

    earned = sum(r["points"] for r in results)
    possible = sum(r["max_points"] for r in results)

    result = {
        "assessment_id": assessment_id,
        "points_earned": round(earned, 3),
        "points_possible": possible,
        "score": round((earned / possible * 100), 2) if possible else 0.0,
        "results": results,
        "short_answer_graded": True,
        "grading_model": grading_model,
        "grading_prompt_version": GRADING_PROMPT_VERSION,
    }
    return EvaluationResult.model_validate(result).model_dump()
