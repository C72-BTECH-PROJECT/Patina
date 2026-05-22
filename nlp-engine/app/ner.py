import spacy
import re

nlp = spacy.load("en_core_web_sm")

SKILL_KEYWORDS = [
    # programming languages
    "python", "java", "javascript", "typescript", "golang",
    "ruby", "rust", "swift", "kotlin", "php", "scala",
    "matlab", "perl", "bash", "dart", "lua", "r language",

    # web frameworks and libraries
    "react", "angular", "vue", "nextjs", "nuxtjs", "nodejs", "express",
    "django", "flask", "fastapi", "spring", "laravel", "rails",
    "jquery", "bootstrap", "tailwind", "redux", "graphql", "webpack",
    "vite", "gatsby", "svelte", "remix",

    # databases
    "mongodb", "mysql", "postgresql", "sqlite", "redis", "firebase",
    "cassandra", "elasticsearch", "dynamodb", "oracle", "mariadb",
    "neo4j", "couchdb", "supabase", "prisma", "sequelize", "mongoose",

    # cloud and devops
    "aws", "azure", "gcp", "docker", "kubernetes", "jenkins", "git",
    "github", "gitlab", "bitbucket", "linux", "terraform", "ansible",
    "nginx", "apache", "heroku", "vercel", "netlify", "cloudflare",
    "digitalocean", "circleci", "tomcat", "grunt", "maven",

    # data science and ml
    "tensorflow", "pytorch", "keras", "scikit-learn", "pandas", "numpy",
    "matplotlib", "seaborn", "opencv", "nlp", "machine learning",
    "deep learning", "computer vision", "data science", "jupyter",
    "spark", "hadoop", "airflow", "mlflow", "transformers", "bert",
    "langchain", "openai", "hugging face",

    # mobile
    "android", "ios", "react native", "flutter", "xamarin", "ionic",
    "expo",

    # general tech
    "html", "css", "sass", "rest", "api", "microservices", "agile",
    "scrum", "sql", "nosql", "json", "xml", "yaml", "jwt", "oauth",
    "websocket", "grpc", "kafka", "rabbitmq", "celery",

    # testing
    "jest", "mocha", "pytest", "selenium", "cypress", "postman",
    "unit testing", "integration testing",

    # concepts
    "system design", "data structures", "algorithms", "oop",
    "design patterns", "solid principles", "clean code",
    "typescript", "exponentjs",
]

def extract_entities(text: str) -> dict:
    doc = nlp(text)
    text_lower = text.lower()

    # ── 1. SKILLS — word boundary matching ──────────────
    found_skills = []
    for skill in SKILL_KEYWORDS:
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, text_lower, re.IGNORECASE):
            if skill not in found_skills:
                found_skills.append(skill)

    # ── 2. EXPERIENCE ────────────────────────────────────
    experience = []
    for ent in doc.ents:
        if ent.label_ == "ORG":
            experience.append({
                "type": "organisation",
                "value": ent.text.strip()
            })
        elif ent.label_ == "DATE":
            experience.append({
                "type": "date",
                "value": ent.text.strip()
            })

    # ── 3. EDUCATION ─────────────────────────────────────
    education_keywords = [
        "university", "college", "bachelor", "master", "phd",
        "degree", "diploma", "school", "b.tech", "m.tech",
        "b.e", "m.e", "bsc", "msc", "hsc", "ssc",
        "engineering", "computer science", "information technology"
    ]
    education = []
    for sent in doc.sents:
        sent_lower = sent.text.lower()
        for keyword in education_keywords:
            if keyword in sent_lower:
                education.append(sent.text.strip())
                break

    # ── 4. PROJECTS ──────────────────────────────────────
    project_keywords = [
        "project", "built", "developed", "created", "implemented",
        "designed", "deployed", "worked on", "contributed",
        "developed", "architected", "launched", "led", "built"
    ]
    projects = []
    for sent in doc.sents:
        sent_lower = sent.text.lower()
        for keyword in project_keywords:
            if keyword in sent_lower:
                projects.append(sent.text.strip())
                break

    experience = [dict(t) for t in {tuple(d.items()) for d in experience}]

    return {
        "skills": found_skills,
        "experience": experience,
        "education": education,
        "projects": projects,
        "skill_count": len(found_skills)
    }

# ── TEST BLOCK ───────────────────────────────────────────
if __name__ == "__main__":
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from app.extractor import extract_text

    raw_text = extract_text("sample_resume.pdf")
    result = extract_entities(raw_text)

    print("──── SKILLS FOUND ────")
    print(result["skills"])

    print("\n──── SKILL COUNT ────")
    print(result["skill_count"])

    print("\n──── EXPERIENCE ────")
    for item in result["experience"]:
        print(f"  {item['type']}: {item['value']}")

    print("\n──── EDUCATION ────")
    for edu in result["education"]:
        print(f"  {edu}")

    print("\n──── PROJECTS ────")
    for proj in result["projects"]:
        print(f"  {proj}")