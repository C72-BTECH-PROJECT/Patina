"""Generation: prompt -> Gemini -> validate 20 -> serve a random 10 (R-07, D§6.1, D§6.2).

R-29: MCQs whose correct option is too long (ratio and character gap, see
validators.mcq_option_tell) are dropped from the pool, and the pool is
regenerated when too few remain.
"""
import copy
import logging
import random
import time
import uuid
from dataclasses import dataclass
from typing import Any

from app import config
from app.llm_client import AssessmentLLMError, generate_json
from app.prompts import PROMPT_VERSION, build_generation_prompt, github_supplied
from app.schemas import AssessmentInput
from app.validators import (
    AssessmentValidationError,
    option_tell_violations,
    validate_assessment,
)

log = logging.getLogger("assessment_service")

# A validation error carries model text; keep the 502 message readable.
_MAX_VALIDATION_DETAIL_CHARS = 400


def _shuffle_mcq_options(
    questions_json: dict[str, Any],
    answers_json: dict[str, Any],
    rng: random.Random,
) -> None:
    """Shuffle MCQ options and preserve the correct answer mapping."""
    answer_by_id = {
        answer["question_id"]: answer
        for answer in answers_json["answers"]
    }

    for question in questions_json["questions"]:
        if question["question_type"] != "mcq":
            continue

        answer = answer_by_id[question["question_id"]]
        old_correct_label = answer["correct_option"]

        correct_option = next(
            option
            for option in question["options"]
            if option["label"] == old_correct_label
        )

        shuffled_options = question["options"].copy()
        rng.shuffle(shuffled_options)

        labels = ["A", "B", "C", "D"]
        old_to_new = {}

        for label, option in zip(labels, shuffled_options):
            old_to_new[option["label"]] = label
            option["label"] = label

        question["options"] = shuffled_options
        answer["correct_option"] = old_to_new[old_correct_label]

        # Defensive check: the correct answer text must remain unchanged.
        if next(
            option["text"]
            for option in question["options"]
            if option["label"] == answer["correct_option"]
        ) != correct_option["text"]:
            raise AssessmentValidationError(
                f"Option shuffling corrupted answer {question['question_id']}."
            )


def draw_served_questions(
    questions_json: dict[str, Any],
    answers_json: dict[str, Any],
    rng: random.Random,
    n_mcq: int | None = None,
    n_short: int | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Pick a random n_mcq MCQs and n_short short answers from the validated
    pool, in random order, renumbered q1..qN, with the key reduced to exactly
    those questions. Nothing about the undrawn questions is returned.
    """
    n_mcq = config.SERVED_MCQ if n_mcq is None else n_mcq
    n_short = config.SERVED_SHORT if n_short is None else n_short

    pool = questions_json["questions"]
    mcqs = [q for q in pool if q["question_type"] == "mcq"]
    shorts = [q for q in pool if q["question_type"] == "short_answer"]
    if n_mcq > len(mcqs) or n_short > len(shorts):
        raise AssessmentValidationError(
            f"Cannot serve {n_mcq} MCQs and {n_short} short answers from "
            f"{len(mcqs)} and {len(shorts)}."
        )

    chosen = rng.sample(mcqs, n_mcq) + rng.sample(shorts, n_short)
    rng.shuffle(chosen)

    answers_by_id = {a["question_id"]: a for a in answers_json["answers"]}
    served_questions = []
    served_answers = []
    for position, question in enumerate(chosen, start=1):
        new_id = f"q{position}"
        served_q = copy.deepcopy(question)
        served_a = copy.deepcopy(answers_by_id[question["question_id"]])
        served_q["question_id"] = new_id
        served_a["question_id"] = new_id
        served_questions.append(served_q)
        served_answers.append(served_a)

    questions_out = {
        key: value for key, value in questions_json.items() if key != "questions"
    }
    questions_out["questions"] = served_questions
    answers_out = {
        key: value for key, value in answers_json.items() if key != "answers"
    }
    answers_out["answers"] = served_answers
    return questions_out, answers_out


@dataclass
class GeneratedPool:
    """A validated pool: the rejected MCQs (R-29) are already removed."""
    questions_json: dict[str, Any]
    answers_json: dict[str, Any]
    rejected: dict[str, str]  # question_id -> reason, from the accepted round
    rounds: int
    seconds: float
    model_used: str
    # One entry per round, rejected rounds included (see generate_pool). Internal:
    # never part of what is served.
    round_log: list[dict[str, Any]]


def _rejected_mcqs(
    questions_json: dict[str, Any],
    answers_json: dict[str, Any],
    rejected: dict[str, str],
) -> list[dict[str, Any]]:
    """The rejected MCQs with their options, correct label and reason, for the round log."""
    correct = {a["question_id"]: a.get("correct_option") for a in answers_json["answers"]}
    return [
        {
            "question_id": q["question_id"],
            "reason": rejected[q["question_id"]],
            "question": q["question"],
            "options": copy.deepcopy(q["options"]),
            "correct_option": correct[q["question_id"]],
        }
        for q in questions_json["questions"]
        if q["question_id"] in rejected
    ]


def _without(
    questions_json: dict[str, Any],
    answers_json: dict[str, Any],
    question_ids: set[str],
) -> tuple[dict[str, Any], dict[str, Any]]:
    questions_out = dict(questions_json)
    questions_out["questions"] = [
        q for q in questions_json["questions"] if q["question_id"] not in question_ids
    ]
    answers_out = dict(answers_json)
    answers_out["answers"] = [
        a for a in answers_json["answers"] if a["question_id"] not in question_ids
    ]
    return questions_out, answers_out


def _option_rule_error(rejected: dict[str, str], total_mcq: int) -> str:
    valid = total_mcq - len(rejected)
    return (
        f"Only {valid} of {total_mcq} multiple-choice questions passed the option "
        f"rule (at least {config.SERVED_MCQ} must): "
        + "; ".join(f"{qid}: {reason}" for qid, reason in rejected.items())
        + ". Rewrite those questions so all four options are of similar length "
        "and the same form."
    )


def generate_pool(
    assessment_input: AssessmentInput | dict[str, Any],
    *,
    round_log: list[dict[str, Any]] | None = None,
) -> GeneratedPool:
    """
    Generate and validate the 20-question pool, regenerating inside the time
    budget until it passes. MCQs whose options give the answer away (R-29) are
    dropped; a round that leaves fewer than SERVED_MCQ valid MCQs is
    regenerated, and when no round does, generation fails: it is never served
    short.

    `round_log`, when given, receives one dict per round (round, model,
    outcome, detail, rejected MCQs with options and reason), also when
    generation fails, so a caller such as the eval report can count every
    rejection. It does not change what is generated or served.
    """
    if round_log is None:
        round_log = []
    if isinstance(assessment_input, AssessmentInput):
        input_data = assessment_input.model_dump()
    else:
        input_data = AssessmentInput.model_validate(
            assessment_input
        ).model_dump()

    if not input_data["include_github"]:
        input_data["github_data"] = None
    has_github = github_supplied(input_data)

    started = time.monotonic()
    deadline = started + config.GENERATION_BUDGET_SECONDS

    assessment_id = str(uuid.uuid4())
    prompt = build_generation_prompt(input_data)
    # validation_errors: capped, for the 502 message; feedback: full, for the model.
    validation_errors: list[str] = []
    feedback: list[str] = []

    for round_number in range(1, config.MAX_VALIDATION_ROUNDS + 1):
        if round_number > 1 and deadline - time.monotonic() < config.MIN_CALL_SECONDS:
            validation_errors.append("no time left in the budget for another round")
            break

        current_prompt = prompt
        if feedback:
            current_prompt += (
                "\n\nYOUR PREVIOUS RESPONSE FAILED VALIDATION.\n"
                "Correct every issue listed below and return the complete "
                "assessment again. Do not omit any questions or answers.\n"
                + "\n".join(f"- {error}" for error in feedback)
            )

        # An LLM failure (every model failed) ends the request: another round
        # would hit the same models with the same budget.
        try:
            payload, model_used = generate_json(current_prompt, deadline=deadline)
        except AssessmentLLMError as exc:
            round_log.append({
                "round": round_number, "model": None, "outcome": "llm_error",
                "detail": f"{exc.code}: {str(exc)[:_MAX_VALIDATION_DETAIL_CHARS]}",
                "rejected": [],
            })
            if not validation_errors or exc.status_code != 502:
                raise
            # Keep why the earlier round was rejected (R-07 verifier note).
            raise AssessmentLLMError(
                f"{exc} Earlier round failed validation: "
                + " | ".join(validation_errors),
                code=exc.code,
            ) from exc

        try:
            questions_json, answers_json = validate_assessment(
                payload=payload,
                candidate_id=input_data["candidate_id"],
                job_id=input_data["job_id"],
                assessment_id=assessment_id,
                model_used=model_used,
                prompt_version=PROMPT_VERSION,
                github_supplied=has_github,
            )
        except AssessmentValidationError as exc:
            validation_errors.append(str(exc)[:_MAX_VALIDATION_DETAIL_CHARS])
            feedback.append(str(exc)[:_MAX_VALIDATION_DETAIL_CHARS])
            round_log.append({
                "round": round_number, "model": model_used, "outcome": "schema_invalid",
                "detail": str(exc)[:_MAX_VALIDATION_DETAIL_CHARS], "rejected": [],
            })
            log.info(
                "generate validation_failed round=%d model=%s", round_number, model_used
            )
            continue

        rejected = option_tell_violations(
            questions_json,
            answers_json,
            max_length_ratio=config.MCQ_MAX_LENGTH_RATIO,
            min_length_gap=config.MCQ_MIN_LENGTH_GAP,
        )
        total_mcq = sum(
            q["question_type"] == "mcq" for q in questions_json["questions"]
        )
        accepted = total_mcq - len(rejected) >= config.SERVED_MCQ
        round_log.append({
            "round": round_number,
            "model": model_used,
            "outcome": "accepted" if accepted else "option_rule_failed",
            "detail": None,
            "rejected": _rejected_mcqs(questions_json, answers_json, rejected),
        })
        if not accepted:
            error = _option_rule_error(rejected, total_mcq)
            validation_errors.append(error[:_MAX_VALIDATION_DETAIL_CHARS])
            feedback.append(error)
            log.info(
                "generate option_rule_failed round=%d model=%s rejected=%d",
                round_number, model_used, len(rejected),
            )
            continue

        pool_q, pool_a = _without(questions_json, answers_json, set(rejected))
        seconds = time.monotonic() - started
        log.info(
            "generate pool ok model=%s rounds=%d seconds=%.1f mcq_rejected=%d",
            model_used, round_number, seconds, len(rejected),
        )
        return GeneratedPool(
            pool_q, pool_a, rejected, round_number, seconds, model_used, round_log
        )

    raise AssessmentLLMError(
        "The generated assessment failed validation: "
        + " | ".join(validation_errors),
        code="llm_invalid_output",
    )


def generate_assessment(
    assessment_input: AssessmentInput | dict[str, Any],
    *,
    rng: random.Random | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Generate, validate and draw an assessment.

    Returns:
        (questions_json, answers_json) for the served questions only.
    """
    pool = generate_pool(assessment_input)

    # Unpredictable in production; tests pass a seeded Random.
    rng = rng or random.SystemRandom()
    served_q, served_a = draw_served_questions(pool.questions_json, pool.answers_json, rng)
    _shuffle_mcq_options(served_q, served_a, rng)

    log.info(
        "generate ok model=%s rounds=%d seconds=%.1f served=%d",
        pool.model_used,
        pool.rounds,
        pool.seconds,
        len(served_q["questions"]),
    )
    return served_q, served_a
