from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# load the S-BERT model once at module level
# all-MiniLM-L6-v2 is lightweight and fast
# gives 384 dimensional vectors
# perfect for semantic similarity tasks
# first time this runs it will download the model (~80MB)
# after that it loads from cache instantly
model = SentenceTransformer('all-MiniLM-L6-v2')

def get_embedding(text: str) -> list:
    # convert text to a 384 dimensional vector
    # normalize_embeddings=True makes cosine similarity
    # more accurate and faster to compute
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()

def compute_similarity(text1: str, text2: str) -> float:
    # encode both texts into vectors
    embeddings = model.encode(
        [text1, text2],
        normalize_embeddings=True
    )
    # compute cosine similarity between the two vectors
    # cosine similarity measures the angle between two vectors
    # 1.0 = identical meaning
    # 0.0 = completely unrelated
    # reshape needed because cosine_similarity expects 2D arrays
    score = cosine_similarity(
        [embeddings[0]],
        [embeddings[1]]
    )[0][0]

    # round to 4 decimal places for clean output
    return round(float(score), 4)

def analyse(resume_text: str, jd_text: str, 
            skills: list = None, 
            noun_chunks: list = None) -> dict:
    
    # build focused resume representation
    # use skills + noun chunks if available
    # much cleaner signal than full resume text
    if skills and noun_chunks:
        # combine skills and noun chunks into focused text
        focused_resume = " ".join(skills) + " " + " ".join(noun_chunks[:20])
    else:
        # fallback to full text if nothing else available
        focused_resume = resume_text

    # compute similarity on focused text vs JD
    similarity = compute_similarity(focused_resume, jd_text)

    # also compute full text similarity as secondary score
    full_similarity = compute_similarity(resume_text[:1000], jd_text)

    # take the higher of the two scores
    # gives benefit of doubt to the candidate
    final_score = max(similarity, full_similarity)

    if final_score >= 0.75:
        match_level = "Strong Match"
    elif final_score >= 0.50:
        match_level = "Moderate Match"
    elif final_score >= 0.30:
        match_level = "Weak Match"
    else:
        match_level = "Poor Match"

    return {
        "similarity_score": round(final_score, 4),
        "focused_score": round(similarity, 4),
        "full_text_score": round(full_similarity, 4),
        "match_level": match_level,
        "resume_embedding_size": 384,
        "jd_embedding_size": 384,
    }

# ── TEST BLOCK ──────────────────────────────────────────
if __name__ == "__main__":
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from app.extractor import extract_text

    # extract real resume text
    resume_text = extract_text("sample_resume.pdf")

    # mock job description to test against
    jd_text = """
    We are looking for a customer service representative
    with strong communication skills and experience working
    in a team environment. The candidate should have
    experience handling cash and serving customers.
    Knowledge of sports is a plus.
    """

    result = analyse(resume_text, jd_text)

    print("──── SIMILARITY SCORE ────")
    print(result["similarity_score"])

    print("\n──── MATCH LEVEL ────")
    print(result["match_level"])

    print("\n──── EMBEDDING SIZE ────")
    print(f"Resume vector: {result['resume_embedding_size']} dimensions")
    print(f"JD vector:     {result['jd_embedding_size']} dimensions")