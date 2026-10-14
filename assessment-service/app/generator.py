
import random
import uuid
from typing import Any

from app.config import MAX_RETRIES_PER_MODEL, PROMPT_VERSION
from app.llm_client import AssessmentLLMError, generate_json
from app.prompts import build_generation_prompt
from app.schemas import AssessmentInput
from app.validators import AssessmentValidationError, validate_assessment


def _shuffle_mcq_options(
    questions_json: dict[str, Any],
    answers_json: dict[str, Any],
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
        random.shuffle(shuffled_options)

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


def generate_assessment(
    assessment_input: AssessmentInput | dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Generate a validated assessment.

    Returns:
        (questions_json, answers_json)
    """
    if isinstance(assessment_input, AssessmentInput):
        input_data = assessment_input.model_dump()
    else:
        input_data = AssessmentInput.model_validate(
            assessment_input
        ).model_dump()

    if not input_data["include_github"]:
        input_data["github_data"] = None

    assessment_id = str(uuid.uuid4())
    prompt = build_generation_prompt(input_data)
    validation_errors = []

    # Each attempt can use the configured model fallback mechanism.
    for attempt in range(MAX_RETRIES_PER_MODEL):
        current_prompt = prompt

        if validation_errors:
            current_prompt += (
                "\n\nYOUR PREVIOUS RESPONSE FAILED VALIDATION.\n"
                "Correct every issue listed below and return the complete "
                "assessment again. Do not omit any questions or answers.\n"
                + "\n".join(f"- {error}" for error in validation_errors)
            )

        try:
            payload, model_used = generate_json(current_prompt)

            questions_json, answers_json = validate_assessment(
                payload=payload,
                candidate_id=input_data["candidate_id"],
                job_id=input_data["job_id"],
                assessment_id=assessment_id,
                model_used=model_used,
                prompt_version=PROMPT_VERSION,
            )

            _shuffle_mcq_options(questions_json, answers_json)

            return questions_json, answers_json

        except AssessmentValidationError as exc:
            validation_errors.append(str(exc))

    details = " | ".join(validation_errors[-MAX_RETRIES_PER_MODEL:])

    raise AssessmentLLMError(
        "Unable to generate a valid assessment after "
        f"{MAX_RETRIES_PER_MODEL} validation attempt(s). "
        f"Validation errors: {details}"
    )

