
from typing import Any

from app.llm_client import AssessmentLLMError, generate_json
from app.prompts import build_short_answer_evaluation_prompt


def _mcq_result(question: dict, key_entry: dict, response_text: str) -> dict:
    correct_option = str(key_entry.get("correct_option", "")).strip().upper()
    response = str(response_text).strip().upper()
    is_correct = response == correct_option
    if is_correct:
        feedback = key_entry.get("explanation") or "Correct."
    else:
        feedback = (
            f"Correct answer: {correct_option}. "
            + (key_entry.get("explanation") or "")
        ).strip()
    return {
        "question_id": question["question_id"],
        "question_type": "mcq",
        "skill": question.get("skill", ""),
        "correct": is_correct,
        "points": 1.0 if is_correct else 0.0,
        "max_points": 1.0,
        "feedback": feedback,
    }


def _unanswered(question: dict) -> dict:
    return {
        "question_id": question["question_id"],
        "question_type": question.get("question_type", "short_answer"),
        "skill": question.get("skill", ""),
        "correct": False,
        "points": 0.0,
        "max_points": 1.0,
        "feedback": "Not answered.",
    }


def evaluate_assessment(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Score a completed assessment.

    MCQ questions are graded deterministically against the answer key.
    Short-answer questions are rubric-graded by the LLM in one batch call; if
    that call fails they are reported as ungraded rather than failing the
    whole request, so the candidate still gets an honest partial result.

    Returns a dict matching EvaluationResult.
    """
    assessment_id = payload["assessment_id"]
    questions = payload["questions"]
    answer_key = payload["answer_key"]
    answers = payload["answers"]

    questions_by_id = {q["question_id"]: q for q in questions}
    keys_by_id = {k["question_id"]: k for k in answer_key}
    answers_by_id = {a["question_id"]: a["response"] for a in answers}

    results: list[dict[str, Any]] = []
    short_items: list[dict] = []
    short_ids: list[str] = []

    for question in questions:
        question_id = question["question_id"]
        key_entry = keys_by_id.get(question_id)
        answer = answers_by_id.get(question_id)

        if question.get("question_type") == "mcq":
            if key_entry and answer:
                results.append(_mcq_result(question, key_entry, answer))
            else:
                results.append(_unanswered(question))
        elif key_entry and answer:
            short_items.append(
                {
                    "question_id": question_id,
                    "question": question.get("question", ""),
                    "candidate_answer": answer,
                    "ideal_answer": key_entry.get("ideal_answer", ""),
                    "key_points": key_entry.get("key_points", []),
                }
            )
            short_ids.append(question_id)
        else:
            results.append(_unanswered(question))

    short_answer_graded = True
    grades_by_id: dict[str, dict] = {}

    if short_items:
        try:
            payload_json, _model = generate_json(
                build_short_answer_evaluation_prompt(short_items)
            )
            for grade in payload_json.get("grades", []):
                if isinstance(grade, dict) and "question_id" in grade:
                    grades_by_id[grade["question_id"]] = grade
            if not grades_by_id:
                raise AssessmentLLMError("No grades returned for short answers.")
        except AssessmentLLMError:
            short_answer_graded = False

        for question_id in short_ids:
            question = questions_by_id[question_id]
            grade = grades_by_id.get(question_id)
            if grade is None:
                results.append(_unanswered(question))
                continue
            try:
                points = float(grade.get("points", 0))
            except (TypeError, ValueError):
                points = 0.0
            points = round(max(0.0, min(1.0, points)), 3)
            results.append(
                {
                    "question_id": question_id,
                    "question_type": "short_answer",
                    "skill": question.get("skill", ""),
                    "correct": points >= 0.999,
                    "points": points,
                    "max_points": 1.0,
                    "feedback": grade.get("feedback") or None,
                }
            )

    earned = sum(r["points"] for r in results)
    possible = sum(r["max_points"] for r in results)

    return {
        "assessment_id": assessment_id,
        "points_earned": round(earned, 3),
        "points_possible": possible,
        "score": round((earned / possible * 100), 2) if possible else 0.0,
        "results": results,
        "short_answer_graded": short_answer_graded,
    }
