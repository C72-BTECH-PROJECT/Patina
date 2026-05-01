import spacy

# load the same english model
# spacy is smart enough to cache this so it
# does not reload if preprocessor already loaded it
nlp = spacy.load("en_core_web_sm")

# define your own skill keywords list
# this acts as a rule based matcher for technical skills
# since en_core_web_sm is not trained on tech resumes
# it won't detect "React" or "MongoDB" as skills by default
# so we manually define what we consider a skill
SKILL_KEYWORDS = [
    # programming languages
    "python", "java", "javascript", "typescript", "c", "c++", "c#",
    "ruby", "go", "rust", "swift", "kotlin", "php", "scala", "r",
    # web frameworks
    "react", "angular", "vue", "nextjs", "nodejs", "express", "django",
    "flask", "fastapi", "spring", "laravel",
    # databases
    "mongodb", "mysql", "postgresql", "sqlite", "redis", "firebase",
    "cassandra", "elasticsearch",
    # cloud and devops
    "aws", "azure", "gcp", "docker", "kubernetes", "jenkins", "git",
    "github", "gitlab", "linux", "terraform", "ansible",
    # data and ml
    "tensorflow", "pytorch", "keras", "scikit-learn", "pandas", "numpy",
    "matplotlib", "opencv", "nlp", "machine learning", "deep learning",
    # general tech skills
    "html", "css", "rest", "graphql", "api", "microservices", "agile",
    "scrum", "sql", "nosql", "json", "xml",
]

def extract_entities(text: str) -> dict:
    doc = nlp(text)
    text_lower = text.lower()

    # ── 1. SKILLS ──────────────────────────────────────
    # check which skills from our keyword list
    # appear anywhere in the resume text
    found_skills = []
    for skill in SKILL_KEYWORDS:
        if skill.lower() in text_lower:
            found_skills.append(skill)

    # ── 2. EXPERIENCE ───────────────────────────────────
    # spacy's built in NER detects ORG (organisations)
    # and DATE entities which map to work experience
    experience = []
    for ent in doc.ents:
        if ent.label_ == "ORG":
            # organisation names = companies worked at
            experience.append({
                "type": "organisation",
                "value": ent.text.strip()
            })
        elif ent.label_ == "DATE":
            # date ranges = employment periods
            experience.append({
                "type": "date",
                "value": ent.text.strip()
            })

    # ── 3. EDUCATION ────────────────────────────────────
    # look for education related keywords in sentences
    education_keywords = [
        "university", "college", "bachelor", "master", "phd",
        "degree", "diploma", "school", "b.tech", "m.tech",
        "b.e", "m.e", "bsc", "msc", "hsc", "ssc", "year 11",
        "year 12", "engineering", "computer science"
    ]
    education = []
    for sent in doc.sents:
        sent_lower = sent.text.lower()
        for keyword in education_keywords:
            if keyword in sent_lower:
                education.append(sent.text.strip())
                break  # avoid adding same sentence twice

    # ── 4. PROJECTS ─────────────────────────────────────
    # look for project related keywords in sentences
    project_keywords = [
        "project", "built", "developed", "created", "implemented",
        "designed", "deployed", "worked on", "contributed"
    ]
    projects = []
    for sent in doc.sents:
        sent_lower = sent.text.lower()
        for keyword in project_keywords:
            if keyword in sent_lower:
                projects.append(sent.text.strip())
                break  # avoid adding same sentence twice

    # remove duplicates while preserving order
    experience = [dict(t) for t in {tuple(d.items()) for d in experience}]

    return {
        "skills": found_skills,
        "experience": experience,
        "education": education,
        "projects": projects,
        "skill_count": len(found_skills)
    }

# ── TEST BLOCK ──────────────────────────────────────────
if __name__ == "__main__":
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from app.extractor import extract_text

    raw_text = extract_text("sample_resume.pdf")
    result = extract_entities(raw_text)

    print("──── SKILLS FOUND ────")
    print(result["skills"])

    print("\n──── EXPERIENCE ────")
    for item in result["experience"]:
        print(f"  {item['type']}: {item['value']}")

    print("\n──── EDUCATION ────")
    for edu in result["education"]:
        print(f"  {edu}")

    print("\n──── PROJECTS ────")
    for proj in result["projects"]:
        print(f"  {proj}")

    print("\n──── SKILL COUNT ────")
    print(result["skill_count"])