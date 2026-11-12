
import logging
import re
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app import config
from app.config import SERVICE_NAME
from app.generator import generate_assessment
from app.evaluator import EvaluateInputError, evaluate_assessment
from app.llm_client import AssessmentLLMError
from app.schemas import AssessmentInput, EvaluateInput
from app.validators import AssessmentValidationError

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
        # Whether a Gemini key and model list are configured. Never the key.
        "llm_configured": config.llm_configured(),
    }


@app.post("/generate-assessment")
def create_assessment(data: AssessmentInput):
    try:
        questions_json, answers_json = generate_assessment(data)

        # Only core calls this service. Core stores the answer key server-side
        # and strips it before anything reaches the browser.
        return {
            "questions": questions_json,
            "answer_key": answers_json,
        }

    except AssessmentLLMError as exc:
        # `error` is a plain token core can read; `message` names the model and
        # the failure (sanitised in llm_client, never key material).
        log.warning("generate failed error=%s message=%s", exc.code, exc)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.code, "message": str(exc)},
        )

    except AssessmentValidationError as exc:
        # Raised after validation, e.g. by the option-shuffle self-check: the
        # model's output could not be served safely. A model problem, not a 500.
        log.warning("generate failed error=llm_invalid_output message=%s", exc)
        return JSONResponse(
            status_code=502,
            content={"error": "llm_invalid_output", "message": str(exc)},
        )

    except Exception as exc:
        log.exception("generate failed with an unexpected error")
        raise HTTPException(
            status_code=500,
            detail="Assessment generation failed. Check service logs.",
        ) from exc


@app.post("/evaluate-assessment")
def score_assessment(data: EvaluateInput):
    try:
        return evaluate_assessment(data.model_dump())

    except AssessmentLLMError as exc:
        # 502 grading_unavailable or 503 llm_not_configured. Never a partial
        # result and never 0 points for answers that were not graded.
        log.warning("evaluate failed error=%s message=%s", exc.code, exc)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.code, "message": str(exc)},
        )

    except EvaluateInputError as exc:
        return JSONResponse(
            status_code=422,
            content={"error": "invalid_evaluate_input", "message": str(exc)},
        )

    except Exception as exc:
        log.exception("evaluate failed with an unexpected error")
        raise HTTPException(
            status_code=500,
            detail="Assessment evaluation failed. Check service logs.",
        ) from exc
