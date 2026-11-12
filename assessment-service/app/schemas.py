from typing import Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictFloat,
    StrictInt,
    model_validator,
)


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

class CandidateAnswer(BaseModel):
    question_id: str = Field(min_length=1, max_length=128)
    # For MCQs: "A"/"B"/"C"/"D". For short answers: free text.
    response: str = Field(min_length=1, max_length=10000)


class EvaluateInput(BaseModel):
    assessment_id: str = Field(min_length=1, max_length=128)
    questions: list[dict[str, Any]] = Field(min_length=1, max_length=50)
    answer_key: list[dict[str, Any]] = Field(min_length=1, max_length=50)
    answers: list[CandidateAnswer] = Field(min_length=1, max_length=50)


# ── Grader output (R-08). Strict: no extra keys, numeric points only. ──────────
class GraderGrade(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_id: str = Field(min_length=1, max_length=128)
    points: StrictInt | StrictFloat
    feedback: str = Field(min_length=1, max_length=1000)


class GraderOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    grades: list[GraderGrade]


# ── Evaluation result returned to core. ────────────────────────────────────────
class QuestionResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_id: str
    question_type: Literal["mcq", "short_answer"]
    skill: str
    correct: bool
    points: Literal[0.0, 0.5, 1.0]
    max_points: float
    # Safe for the candidate: written by code, never the correct option, the
    # ideal answer, key points or explanation.
    candidate_feedback: str
    # Full detail for the recruiter: correct option and explanation, or the
    # grader's reasoning.
    recruiter_feedback: str


class EvaluationResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assessment_id: str
    points_earned: float
    points_possible: float
    score: float
    results: list[QuestionResult]
    # Always true: if any answered short answer cannot be graded, the call
    # fails with 502 grading_unavailable instead of returning a result.
    short_answer_graded: Literal[True]
    grading_model: str | None
    grading_prompt_version: str
