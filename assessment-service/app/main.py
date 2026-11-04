
import logging
import re
import uuid

from fastapi import FastAPI, HTTPException, Request

from app.config import SERVICE_NAME
from app.generator import generate_assessment
from app.evaluator import evaluate_assessment
from app.llm_client import AssessmentLLMError
from app.schemas import AssessmentInput, EvaluateInput

app = FastAPI(
    title=SERVICE_NAME,
    description=(
        "Generates role-specific technical assessments with separate "
        "candidate questions and server-side answer keys."
    ),
    version="1.0.0",
    # T-0029 (I-0061, DEC-5): internal service, no interactive docs or schema.
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

logging.basicConfig(format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("assessment_service")
log.setLevel(logging.INFO)

# Same rule as github-evidence (app/contract.py) and core (internalHttp.js).
REQUEST_ID_RE = re.compile(r"[A-Za-z0-9-]{1,64}")


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    supplied = request.headers.get("x-request-id", "")
    rid = supplied if REQUEST_ID_RE.fullmatch(supplied) else str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = rid
    log.info("request request_id=%s method=%s path=%s status=%d", rid, request.method,
             request.url.path, response.status_code)
    return response


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


@app.post("/evaluate-assessment")
def score_assessment(data: EvaluateInput):
    try:
        return evaluate_assessment(data.model_dump())

    except AssessmentLLMError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Assessment evaluation failed. Check service logs.",
        ) from exc
