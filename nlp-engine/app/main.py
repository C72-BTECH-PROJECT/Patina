from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import json
import logging
import shutil
import os
import uuid
import re
from pathlib import Path

from app.extractor import (
    REASON_CORRUPT,
    REASON_EMPTY,
    REASON_NO_TEXT_LAYER,
    SUPPORTED_EXTENSIONS,
    UnreadableDocument,
    extract_text,
    file_extension,
)
from app.preprocessor import preprocess
from app.ner import extract_entities
from app.embedder import analyse

# The one version string for this parser. Reported in every /parse response
# and on GET /, so core stores what actually produced a parse instead of a
# hardcoded copy. Bump it whenever the response contract or extraction changes.
PARSER_VERSION = "nlp-engine@2.0.0"
SERVICE_VERSION = PARSER_VERSION.split("@", 1)[1]

# `raw_text` carries the full extracted text up to this many characters.
RAW_TEXT_LIMIT = 20_000

logger = logging.getLogger("nlp-engine")

app = FastAPI(
    title="NLP Parser Microservice",
    description="Resume parsing engine for AI Skill Validation Framework",
    version=SERVICE_VERSION,
)

# Anchored to nlp-engine/ (the old relative path depended on the working directory).
UPLOAD_DIR = str(Path(__file__).resolve().parent.parent / "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

_VALID_RID = re.compile(r"^[A-Za-z0-9-]{1,64}$")

_UNREADABLE_MESSAGES = {
    REASON_NO_TEXT_LAYER: "The document has pages but no text layer (for example a scanned image). OCR is not available.",
    REASON_EMPTY: "The document is empty.",
    REASON_CORRUPT: "The file could not be opened as the type its extension claims.",
}


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    rid = request.headers.get("x-request-id")
    if not rid or not _VALID_RID.match(rid):
        rid = str(uuid.uuid4())
    request.state.request_id = rid
    response = await call_next(request)
    response.headers["X-Request-ID"] = rid
    return response


# 422 is reserved for `unreadable_document`. A request that is missing a field
# or has a wrongly typed one is a client error of a different kind: 400.
@app.exception_handler(RequestValidationError)
async def _invalid_request(request: Request, exc: RequestValidationError):
    fields = sorted({str(err.get("loc", ["", "?"])[-1]) for err in exc.errors()})
    return JSONResponse(
        status_code=400,
        content={
            "error": "invalid_request",
            "fields": fields,
            "message": "The request is missing a required field or has an invalid one.",
        },
    )


@app.get("/")
def health_check():
    return {
        "status": "running",
        "service": "NLP Parser Microservice",
        "version": SERVICE_VERSION,
        "parser_version": PARSER_VERSION,
    }


class InvalidSkillList(Exception):
    def __init__(self, field: str):
        super().__init__(field)
        self.field = field


def _parse_skill_list(raw: str, field: str) -> list:
    """Decode a JSON array of skill strings from a form field.

    A missing or blank field means "no list" ([]). Anything else that is not a
    JSON array of strings is rejected (400) instead of being read as [] and
    silently switching the job-skill source to scraping the JD text.
    """
    if raw is None or not raw.strip():
        return []
    try:
        value = json.loads(raw)
    except (ValueError, TypeError):
        raise InvalidSkillList(field)
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise InvalidSkillList(field)
    return [item for item in value if item.strip()]


def _error(status: int, content: dict) -> JSONResponse:
    return JSONResponse(status_code=status, content=content)


@app.post("/parse")
async def parse_resume(
    request: Request,
    resume: UploadFile = File(...),
    # Optional. Without a job description (e.g. parsing at upload time) no
    # similarity is computed: the response carries `"semantic_analysis": null`.
    # null means "not computed"; it is never a 0 score. A blank `jd` counts as
    # absent. `required_skills` / `preferred_skills` are still validated but
    # are unused without a `jd`.
    jd: str | None = Form(None),
    # The stored job's structured skill lists. When present they are the
    # authoritative job-skill source; `jd` (the markdown description) is then
    # only used as text for semantic similarity.
    required_skills: str = Form("[]"),
    preferred_skills: str = Form("[]"),
):
    try:
        jd_required = _parse_skill_list(required_skills, "required_skills")
        jd_preferred = _parse_skill_list(preferred_skills, "preferred_skills")
    except InvalidSkillList as exc:
        return _error(400, {
            "error": "invalid_skill_list",
            "field": exc.field,
            "message": f"{exc.field} must be a JSON array of strings.",
        })

    file_ext = file_extension(resume.filename)
    if file_ext not in SUPPORTED_EXTENSIONS:
        return _error(415, {
            "error": "unsupported_file_type",
            "extension": file_ext[:16] or None,
            "supported": list(SUPPORTED_EXTENSIONS),
            "message": "Only PDF, DOCX and TXT resumes can be parsed.",
        })

    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(resume.file, buffer)

    try:
        try:
            raw_text = extract_text(file_path)
        except UnreadableDocument as exc:
            logger.warning(
                "unreadable_document reason=%s detail=%s request_id=%s",
                exc.reason, exc, getattr(request.state, "request_id", None),
            )
            return _error(422, {
                "error": "unreadable_document",
                "reason": exc.reason,
                "message": _UNREADABLE_MESSAGES[exc.reason],
            })

        preprocessed = preprocess(raw_text)
        entities = extract_entities(raw_text)

        has_jd = jd is not None and bool(jd.strip())
        embedding_result = None
        if has_jd:
            embedding_result = analyse(
                resume_text=raw_text,
                jd_text=jd,
                skills=entities["skills"],
                noun_chunks=preprocessed["noun_chunks"],
                jd_required_skills=jd_required,
                jd_preferred_skills=jd_preferred,
            )

        return {
            "status": "success",
            "parser_version": PARSER_VERSION,
            "filename": resume.filename,
            "raw_text_preview": raw_text[:300],
            "raw_text": raw_text[:RAW_TEXT_LIMIT],
            "raw_text_truncated": len(raw_text) > RAW_TEXT_LIMIT,
            "preprocessing": {
                "token_count": preprocessed["token_count"],
                "tokens_preview": preprocessed["tokens"][:20],
                "noun_chunks_preview": preprocessed["noun_chunks"][:10],
                "sentence_count": len(preprocessed["sentences"])
            },
            "entities": {
                "candidate_name": entities.get("candidate_name"),
                "email": entities.get("email"),
                "phone": entities.get("phone"),
                "github": entities.get("github"),
                "linkedin": entities.get("linkedin"),
                "skills": entities["skills"],
                "skill_count": entities["skill_count"],
                "experience": entities["experience"],
                "education": entities["education"],
                "projects": entities["projects"]
            },
            # Score components so consumers can explain why a candidate did or
            # did not match. null when no `jd` was sent (see the `jd` parameter).
            "semantic_analysis": embedding_result
        }

    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
