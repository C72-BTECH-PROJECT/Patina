import re

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

from app.ner import SKILL_ALIASES, extract_skills, normalize_skills


# Load once when the service starts. This model is lightweight enough for a
# local API while still providing useful sentence-level similarity.
model = SentenceTransformer("all-MiniLM-L6-v2")

# How the two signals combine into the parsing sub-score. These are emitted with
# every response as `component_weights` so the explainability layer can state
# what each component contributed instead of hard-coding the same numbers again
# on the Node side.
SKILL_COVERAGE_WEIGHT = 0.60
SEMANTIC_SCORE_WEIGHT = 0.40


def get_embedding(text: str) -> list:
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def compute_similarity(text1: str, text2: str) -> float:
    """Return cosine similarity, bounded to the usable 0..1 range."""
    if not text1.strip() or not text2.strip():
        return 0.0

    embeddings = model.encode([text1, text2], normalize_embeddings=True)
    score = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
    return round(max(0.0, min(1.0, float(score))), 4)


def _skill_evidence_lines(resume_text: str, resume_skills: list) -> list:
    """Keep resume lines that substantiate a detected technical skill."""
    aliases = []
    for skill in resume_skills:
        aliases.extend(SKILL_ALIASES.get(skill, (skill,)))

    evidence = []
    seen = set()
    for line in resume_text.splitlines():
        clean_line = " ".join(line.split()).strip()
        lowered = clean_line.lower()
        if len(clean_line) < 8 or lowered in seen:
            continue
        if any(re.search(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", lowered) for alias in aliases):
            evidence.append(clean_line[:300])
            seen.add(lowered)
        if len(evidence) == 24:
            break
    return evidence


def _focused_resume_text(resume_text: str, resume_skills: list) -> str:
    """Build a compact, relevant representation instead of arbitrary chunks."""
    evidence_lines = _skill_evidence_lines(resume_text, resume_skills)
    parts = []
    if resume_skills:
        parts.append("Candidate technical skills: " + ", ".join(resume_skills))
    if evidence_lines:
        parts.append("Technical evidence: " + "\n".join(evidence_lines))
    return "\n".join(parts) or resume_text[:8000]


def _match_level(final_score: float, skill_coverage: float | None, semantic_score: float) -> str:
    """Do not label a match strong when the JD's named skills are missing."""
    if skill_coverage is None:
        if semantic_score >= 0.70:
            return "Strong Match"
        if semantic_score >= 0.50:
            return "Moderate Match"
        if semantic_score >= 0.30:
            return "Weak Match"
        return "Poor Match"

    if skill_coverage >= 0.75 and semantic_score >= 0.55:
        return "Strong Match"
    if skill_coverage >= 0.45 and semantic_score >= 0.40:
        return "Moderate Match"
    if final_score >= 0.30:
        return "Weak Match"
    return "Poor Match"


def _resolve_jd_skills(
    jd_text: str,
    jd_required_skills: list | None,
    jd_preferred_skills: list | None,
) -> tuple[list, str]:
    """Decide which job-skill source is authoritative.

    The stored job's structured skill lists win. `required_skills` and
    `preferred_skills` are both treated as required for matching purposes for
    now (the only job in the database has no preferred skills; a distinct,
    lower weight for preferred skills is a future item). The markdown job
    description is scraped for skills only when no structured list exists.
    """
    structured = normalize_skills(
        list(jd_required_skills or []) + list(jd_preferred_skills or [])
    )
    if structured:
        return structured, "structured_skills"
    return normalize_skills(extract_skills(jd_text)), "parsed_description"


def analyse(
    resume_text: str,
    jd_text: str,
    skills: list | None = None,
    noun_chunks: list | None = None,
    jd_required_skills: list | None = None,
    jd_preferred_skills: list | None = None,
) -> dict:
    """Assess fit using semantic similarity and explicit JD requirements.

    Embeddings recognise related wording but are not proof that a candidate has
    a required technology. When the JD names recognised skills, skill coverage
    is the primary signal; semantic scores provide contextual evidence.
    """
    del noun_chunks  # Kept for compatibility with the existing endpoint.

    resume_skills = normalize_skills(skills if skills is not None else extract_skills(resume_text))
    jd_skills, jd_source = _resolve_jd_skills(
        jd_text, jd_required_skills, jd_preferred_skills
    )
    resume_skill_set = set(resume_skills)

    matched_skills = [skill for skill in jd_skills if skill in resume_skill_set]
    missing_skills = [skill for skill in jd_skills if skill not in resume_skill_set]
    skill_coverage = (
        round(len(matched_skills) / len(jd_skills), 4)
        if jd_skills else None
    )

    focused_resume = _focused_resume_text(resume_text, resume_skills)
    focused_similarity = compute_similarity(focused_resume, jd_text)
    full_text_similarity = compute_similarity(resume_text[:8000], jd_text)
    semantic_score = round(
        (0.65 * focused_similarity) + (0.35 * full_text_similarity), 4
    )

    # Named skills are the most checkable requirements in a technical JD.
    # For a JD without recognised skills, semantic context is the only signal.
    if skill_coverage is not None:
        component_weights = {
            "skill_coverage": SKILL_COVERAGE_WEIGHT,
            "semantic_score": SEMANTIC_SCORE_WEIGHT,
        }
        final_score = (
            (SKILL_COVERAGE_WEIGHT * skill_coverage)
            + (SEMANTIC_SCORE_WEIGHT * semantic_score)
        )
    else:
        component_weights = {"skill_coverage": 0.0, "semantic_score": 1.0}
        final_score = semantic_score
    final_score = round(min(1.0, max(0.0, final_score)), 4)

    source_phrase = (
        "the role's listed required/preferred skills"
        if jd_source == "structured_skills"
        else "skills parsed from the job-description text"
    )
    match_level = _match_level(final_score, skill_coverage, semantic_score)
    if skill_coverage is None:
        match_reason = "Match level is based on semantic context; no recognised technical requirements were found in the job description."
    elif missing_skills:
        match_reason = "Matched {} of {} job skills (from {}); missing: {}.".format(
            len(matched_skills), len(jd_skills), source_phrase, ", ".join(missing_skills)
        )
    else:
        match_reason = "All {} job skills (from {}) were found in the resume.".format(
            len(jd_skills), source_phrase
        )

    return {
        # Existing fields consumed by the Node backend.
        "similarity_score": final_score,
        "focused_score": focused_similarity,
        "full_text_score": full_text_similarity,
        "match_level": match_level,
        "resume_embedding_size": 384,
        "jd_embedding_size": 384,
        # Explainable fields for the UI, debugging, and future scoring logic.
        "semantic_score": semantic_score,
        "skill_coverage": skill_coverage,
        "component_weights": component_weights,
        "resume_skills": resume_skills,
        "jd_skills": jd_skills,
        "jd_source": jd_source,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "match_reason": match_reason,
    }
