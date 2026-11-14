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
    extract_document,
    file_extension,
)
from pydantic import BaseModel

from app.preprocessor import preprocess
from app.ner import (
    GENERIC_SKILL_PATTERNS,
    SKILL_ALIASES,
    SKILL_KEYWORDS,
    _ALIAS_TO_CANONICAL,
    _EXTRA_NORMALISATION,
    extract_entities,
    extract_skills,
    normalize_skill,
    normalize_skills,
)
from app.embedder import analyse

# The one version string for this parser. Reported in every /parse response
# and on GET /, so core stores what actually produced a parse instead of a
# hardcoded copy. Bump it whenever the response contract or extraction changes.
# 2.1.0 (R-30): `entities.links`; `entities.education` is one object per
# qualification; link targets behind words feed github/linkedin; DOCX tables,
# headers, footers and text boxes are read; the name never carries contact tokens.
# 2.2.0 (R-21): skill vocabulary: "github" removed, English words and bare
# "API" need technical context, Node.js is not JavaScript, C / Go / R detected
# (Go's canonical name is now "go", was "golang"), IT support tools added;
# links and email addresses are not read for skills.
PARSER_VERSION = "nlp-engine@2.2.0"
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


# --- Skill vocabulary and skills-from-text (R-32) ------------------------------
# The job form's skill input searches this vocabulary and suggests the skills
# found in a job description. Both read app/ner.py, the one skill vocabulary, and
# never change what /parse returns.
#
# A vocabulary name is the canonical spelling the parser itself produces for a
# job description (normalize_skills(extract_skills(text)), as in
# app/embedder.py), so a skill picked from the list and a skill read from the
# description are the same string. Each name carries the spellings that
# normalize_skill maps onto it ("js" -> "javascript", "postgres" -> "postgresql").

SKILLS_TEXT_LIMIT = 50_000


def skill_vocabulary() -> list:
    """[{"name": canonical, "aliases": [...]}] sorted by name."""
    names = normalize_skills(
        list(SKILL_KEYWORDS) + list(GENERIC_SKILL_PATTERNS) + list(SKILL_ALIASES)
    )
    aliases = {name: set() for name in names}
    for alias in list(_ALIAS_TO_CANONICAL) + list(_EXTRA_NORMALISATION):
        canonical = normalize_skill(alias)
        if canonical in aliases and alias != canonical:
            aliases[canonical].add(alias)
    return [{"name": name, "aliases": sorted(aliases[name])} for name in sorted(names)]


class SkillsFromText(BaseModel):
    text: str


@app.get("/skills/vocabulary")
def get_skill_vocabulary():
    return {"parser_version": PARSER_VERSION, "skills": skill_vocabulary()}


@app.post("/skills/extract")
def extract_skills_from_text(body: SkillsFromText):
    if len(body.text) > SKILLS_TEXT_LIMIT:
        return _error(400, {
            "error": "text_too_long",
            "limit": SKILLS_TEXT_LIMIT,
            "message": f"The text is longer than {SKILLS_TEXT_LIMIT} characters.",
        })
    return {
        "parser_version": PARSER_VERSION,
        "skills": normalize_skills(extract_skills(body.text)),
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
            document = extract_document(file_path)
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

        raw_text = document.text
        preprocessed = preprocess(raw_text)
        # Link targets attached to words go to the contact parser only; they are
        # never added to raw_text, so skills and similarity do not change (R-30).
        entities = extract_entities(raw_text, links=document.links)

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
                "links": entities.get("links", []),
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
