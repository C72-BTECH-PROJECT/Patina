from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import uuid

from app.extractor import extract_text
from app.preprocessor import preprocess
from app.ner import extract_entities
from app.embedder import analyse

# ── APP SETUP ───────────────────────────────────────────
app = FastAPI(
    title="NLP Parser Microservice",
    description="Resume parsing engine for AI Skill Validation Framework",
    version="1.0.0"
)

# ── CORS ─────────────────────────────────────────────────
# allows your React mock dashboard to call this API
# without getting blocked by browser security
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── UPLOAD FOLDER ────────────────────────────────────────
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── HEALTH CHECK ─────────────────────────────────────────
@app.get("/")
def health_check():
    return {
        "status": "running",
        "service": "NLP Parser Microservice",
        "version": "1.0.0"
    }

# ── MAIN PARSE ENDPOINT ──────────────────────────────────
@app.post("/parse")
async def parse_resume(
    resume: UploadFile = File(...),
    jd: str = Form(...)
):
    # ── step 1: save uploaded file temporarily ───────────
    # give it a unique name to avoid conflicts
    # if two people upload at the same time
    file_ext = os.path.splitext(resume.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(resume.file, buffer)

    try:
        # ── step 2: extract raw text ─────────────────────
        raw_text = extract_text(file_path)

        # ── step 3: preprocess text ───────────────────────
        preprocessed = preprocess(raw_text)

        # ── step 4: extract entities ──────────────────────
        entities = extract_entities(raw_text)

        # ── step 5: semantic similarity ───────────────────
        embedding_result = analyse(raw_text, jd)

        # ── step 6: return full result ────────────────────
        return {
            "status": "success",
            "filename": resume.filename,
            "raw_text_preview": raw_text[:300],
            "preprocessing": {
                "token_count": preprocessed["token_count"],
                "tokens_preview": preprocessed["tokens"][:20],
                "noun_chunks_preview": preprocessed["noun_chunks"][:10],
                "sentence_count": len(preprocessed["sentences"])
            },
            "entities": {
                "skills": entities["skills"],
                "skill_count": entities["skill_count"],
                "experience": entities["experience"],
                "education": entities["education"],
                "projects": entities["projects"]
            },
            "semantic_analysis": {
                "similarity_score": embedding_result["similarity_score"],
                "match_level": embedding_result["match_level"]
            }
        }

    finally:
        # ── always delete the temp file after processing ──
        # don't store resumes on disk permanently
        if os.path.exists(file_path):
            os.remove(file_path)