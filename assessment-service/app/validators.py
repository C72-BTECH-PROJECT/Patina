
from typing import Any

from pydantic import ValidationError

from app.schemas import (
    AssessmentAnswerKey,
    AssessmentQuestions,
    MCQQuestion,
    ShortAnswerQuestion,
)


class AssessmentValidationError(ValueError):
    """Raised when generated assessment content is invalid."""


def validate_assessment(
    payload: dict[str, Any],
    candidate_id: str,
    job_id: str,
    assessment_id: str,
    model_used: str,
    prompt_version: str,
) -> tuple[dict, dict]:
    """
    Validate the generated questions and answer key.

    Returns:
        (questions_json, answers_json)
    """
    if not isinstance(payload, dict):
        raise AssessmentValidationError("Output must be a JSON object.")

    raw_questions = payload.get("questions")
    raw_answers = payload.get("answers")

    if not isinstance(raw_questions, list):
        raise AssessmentValidationError("'questions' must be an array.")

    if not isinstance(raw_answers, list):
        raise AssessmentValidationError("'answers' must be an array.")

    if len(raw_questions) != 20:
        raise AssessmentValidationError(
            f"Expected exactly 20 questions; received {len(raw_questions)}."
        )

    if len(raw_answers) != 20:
        raise AssessmentValidationError(
            f"Expected exactly 20 answers; received {len(raw_answers)}."
        )

    try:
        mcq_count = sum(
            item.get("question_type") == "mcq"
            for item in raw_questions
            if isinstance(item, dict)
        )
        short_count = sum(
            item.get("question_type") == "short_answer"
            for item in raw_questions
            if isinstance(item, dict)
        )

        if mcq_count != 10 or short_count != 10:
            raise AssessmentValidationError(
                "Expected 10 MCQs and 10 short-answer questions; "
                f"received {mcq_count} MCQs and {short_count} short answers."
            )

        questions_by_id = {}
        parsed_questions = []

        for item in raw_questions:
            question_type = item.get("question_type") if isinstance(item, dict) else None

            if question_type == "mcq":
                parsed = MCQQuestion.model_validate(item)
            elif question_type == "short_answer":
                parsed = ShortAnswerQuestion.model_validate(item)
            else:
                raise AssessmentValidationError(
                    f"Invalid question type: {question_type!r}."
                )

            if parsed.question_id in questions_by_id:
                raise AssessmentValidationError(
                    f"Duplicate question ID: {parsed.question_id}."
                )

            questions_by_id[parsed.question_id] = parsed
            parsed_questions.append(parsed)

        expected_ids = {f"q{i}" for i in range(1, 21)}
        actual_ids = set(questions_by_id)

        if actual_ids != expected_ids:
            raise AssessmentValidationError(
                "Question IDs must be exactly q1 through q20."
            )

        answers_by_id = {}

        for answer in raw_answers:
            if not isinstance(answer, dict):
                raise AssessmentValidationError(
                    "Every answer key entry must be an object."
                )

            question_id = answer.get("question_id")

            if not isinstance(question_id, str) or not question_id:
                raise AssessmentValidationError(
                    "Every answer key entry needs a question_id."
                )

            if question_id in answers_by_id:
                raise AssessmentValidationError(
                    f"Duplicate answer key ID: {question_id}."
                )

            answers_by_id[question_id] = answer

        if set(answers_by_id) != expected_ids:
            raise AssessmentValidationError(
                "Answer key IDs must match q1 through q20 exactly."
            )

        for question_id, question in questions_by_id.items():
            answer = answers_by_id[question_id]

            if isinstance(question, MCQQuestion):
                if "correct_option" not in answer or "explanation" not in answer:
                    raise AssessmentValidationError(
                        f"MCQ answer {question_id} needs correct_option "
                        "and explanation."
                    )

                if "ideal_answer" in answer or "key_points" in answer:
                    raise AssessmentValidationError(
                        f"MCQ answer {question_id} contains short-answer fields."
                    )

            elif isinstance(question, ShortAnswerQuestion):
                if "ideal_answer" not in answer or "key_points" not in answer:
                    raise AssessmentValidationError(
                        f"Short-answer key {question_id} needs ideal_answer "
                        "and key_points."
                    )

                if "correct_option" in answer:
                    raise AssessmentValidationError(
                        f"Short-answer key {question_id} cannot have "
                        "correct_option."
                    )

        question_objects = [
            question.model_dump()
            for question in sorted(
                parsed_questions,
                key=lambda question: int(question.question_id[1:]),
            )
        ]

        answer_objects = []

        for question in question_objects:
            question_id = question["question_id"]
            answer = answers_by_id[question_id]

            if question["question_type"] == "mcq":
                answer_objects.append(
                    {
                        "question_id": question_id,
                        "correct_option": answer["correct_option"],
                        "explanation": answer["explanation"],
                    }
                )
            else:
                answer_objects.append(
                    {
                        "question_id": question_id,
                        "ideal_answer": answer["ideal_answer"],
                        "key_points": answer["key_points"],
                    }
                )

        validated_questions = AssessmentQuestions.model_validate(
            {
                "assessment_id": assessment_id,
                "candidate_id": candidate_id,
                "job_id": job_id,
                "model_used": model_used,
                "prompt_version": prompt_version,
                "questions": question_objects,
            }
        )

        validated_answers = AssessmentAnswerKey.model_validate(
            {
                "assessment_id": assessment_id,
                "answers": answer_objects,
            }
        )

        question_types = {
            question.question_id: question.question_type
            for question in validated_questions.questions
        }

        for answer in validated_answers.answers:
            question_type = question_types[answer.question_id]

            if question_type == "mcq" and not hasattr(answer, "correct_option"):
                raise AssessmentValidationError(
                    f"MCQ {answer.question_id} has an invalid answer type."
                )

            if (
                question_type == "short_answer"
                and not hasattr(answer, "ideal_answer")
            ):
                raise AssessmentValidationError(
                    f"Short answer {answer.question_id} has an invalid answer type."
                )

        return validated_questions.model_dump(), validated_answers.model_dump()

    except ValidationError as exc:
        raise AssessmentValidationError(
            f"Generated assessment failed schema validation: {exc}"
        ) from exc
