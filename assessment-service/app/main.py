
from fastapi import FastAPI, HTTPException

from app.config import SERVICE_NAME
from app.generator import generate_assessment
from app.llm_client import AssessmentLLMError
from app.schemas import AssessmentInput

app = FastAPI(
    title=SERVICE_NAME,
    description=(
        "Generates role-specific technical assessments with separate "
        "candidate questions and server-side answer keys."
    ),
    version="1.0.0",
)


@app.get("/")
def health_check():
    return {
        "service": SERVICE_NAME,
        "status": "healthy",
    }


@app.post("/generate-assessment")
def create_assessment(data: AssessmentInput):
    try:
        questions_json, answers_json = generate_assessment(data)

        # Return the answer key only to this trusted development endpoint.
        # In production, expose candidate questions and keep answers server-side.
        return {
            "questions": questions_json,
            "answer_key": answers_json,
        }

    except AssessmentLLMError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Assessment generation failed. Check service logs.",
        ) from exc
