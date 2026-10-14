from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class AssessmentInput(BaseModel):
    candidate_id: str = Field(min_length=1, max_length=128)
    job_id: str = Field(min_length=1, max_length=128)

    job_title: str = Field(min_length=1, max_length=200)
    job_description: str = Field(min_length=1, max_length=12000)
    required_skills: list[str] = Field(default_factory=list, max_length=50)
    preferred_skills: list[str] = Field(default_factory=list, max_length=50)

    resume_text: str = Field(min_length=1, max_length=20000)
    resume_skills: list[str] = Field(default_factory=list, max_length=100)
    resume_projects: list[dict[str, Any]] = Field(default_factory=list, max_length=30)
    experience_level: str = Field(default="unspecified", max_length=100)

    include_github: bool = False
    github_data: dict[str, Any] | None = None


class MCQOption(BaseModel):
    label: Literal["A", "B", "C", "D"]
    text: str = Field(min_length=1, max_length=1000)


class MCQQuestion(BaseModel):
    question_id: str
    question_type: Literal["mcq"] = "mcq"
    question: str = Field(min_length=1, max_length=2000)
    options: list[MCQOption] = Field(min_length=4, max_length=4)
    skill: str = Field(min_length=1, max_length=200)
    source: Literal["jd", "resume", "github"]

    @model_validator(mode="after")
    def validate_options(self):
        labels = [option.label for option in self.options]
        if set(labels) != {"A", "B", "C", "D"}:
            raise ValueError("MCQ options must use A, B, C and D exactly once")
        if len({option.text.strip() for option in self.options}) != 4:
            raise ValueError("MCQ options must have unique text")
        return self


class ShortAnswerQuestion(BaseModel):
    question_id: str
    question_type: Literal["short_answer"] = "short_answer"
    question: str = Field(min_length=1, max_length=2000)
    skill: str = Field(min_length=1, max_length=200)
    source: Literal["jd", "resume", "github"]


class AssessmentQuestions(BaseModel):
    assessment_id: str
    candidate_id: str
    job_id: str
    model_used: str
    prompt_version: str
    questions: list[MCQQuestion | ShortAnswerQuestion] = Field(
        min_length=20, max_length=20
    )


class MCQAnswerKey(BaseModel):
    question_id: str
    correct_option: Literal["A", "B", "C", "D"]
    explanation: str = Field(min_length=1, max_length=2000)


class ShortAnswerKey(BaseModel):
    question_id: str
    ideal_answer: str = Field(min_length=1, max_length=1000)
    key_points: list[str] = Field(min_length=2, max_length=4)


class AssessmentAnswerKey(BaseModel):
    assessment_id: str
    answers: list[MCQAnswerKey | ShortAnswerKey] = Field(
        min_length=20, max_length=20
    )