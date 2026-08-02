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

    # ── 0. CANDIDATE NAME ────────────────────────────────
    candidate_name = None
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            # Usually the first person mentioned is the candidate
            # Specifically if it's near the top
            if len(ent.text.split()) >= 2: # Ensure it's likely a full name
                 candidate_name = ent.text.strip()
                 break

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

    # Split text line by line to prevent massive blocks caused by missing punctuation in resumes
    lines = [line.strip() for line in text.split('\n') if len(line.strip()) > 5]

    # ── 3. EDUCATION ─────────────────────────────────────
    education_keywords = [
        "university", "college", "bachelor", "master", "phd",
        "degree", "diploma", "school", "b.tech", "m.tech",
        "b.e", "m.e", "bsc", "msc", "hsc", "ssc",
        "engineering", "computer science", "information technology"
    ]
    education = []
    for line in lines:
        line_lower = line.lower()
        for keyword in education_keywords:
            if keyword in line_lower:
                if line not in education:
                    education.append(line)
                break

    # ── 4. PROJECTS ──────────────────────────────────────
    project_keywords = [
        "project", "built", "developed", "created", "implemented",
        "designed", "deployed", "worked on", "contributed",
        "architected", "launched", "led"
    ]
    projects = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        line_lower = line.lower()
        is_project = any(keyword in line_lower for keyword in project_keywords)
        
        if is_project:
            # Clean bullet points from title
            title = re.sub(r'^[\W_]+', '', line).strip()
            
            # Grab next few lines for description
            description_lines = []
            j = i + 1
            while j < len(lines) and j < i + 4:
                desc_line = lines[j]
                # Break if next line looks like a new section heading
                if len(desc_line.split()) < 3 and desc_line.isupper():
                    break
                clean_desc = re.sub(r'^[\W_]+', '', desc_line).strip()
                if clean_desc:
                    description_lines.append(clean_desc)
                j += 1
                
            # Avoid adding exact duplicate titles
            if not any(p['title'] == title for p in projects):
                projects.append({
                    "title": title,
                    "description": " ".join(description_lines)
                })
            i = j - 1 # skip lines added to description
        i += 1

    # ── 5. REGEX EXTRACTIONS (Email, Phone, Links) ───────
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    phone_pattern = r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
    github_pattern = r'(?:https?://)?(?:www\.)?github\.com/[A-Za-z0-9_.-]+'
    linkedin_pattern = r'(?:https?://)?(?:www\.)?linkedin\.com/in/[A-Za-z0-9_.-]+'

    emails = list(set(re.findall(email_pattern, text)))
    
    # Phone numbers might have duplicates due to formatting, keep distinct digits
    phones_raw = re.findall(phone_pattern, text)
    phones = list(set([re.sub(r'[^0-9+]', '', p) for p in phones_raw if len(re.sub(r'[^0-9]', '', p)) >= 10]))

    github_links = list(set(re.findall(github_pattern, text)))
    linkedin_links = list(set(re.findall(linkedin_pattern, text)))

    return {
        "candidate_name": candidate_name,
        "email": emails[0] if emails else None,
        "phone": phones[0] if phones else None,
        "github": github_links[0] if github_links else None,
        "linkedin": linkedin_links[0] if linkedin_links else None,
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

    print("──── CANDIDATE NAME ────")
    print(result["candidate_name"])
    
    print("\n──── CONTACT & LINKS ────")
    print(f"Email: {result['email']}")
    print(f"Phone: {result['phone']}")
    print(f"GitHub: {result['github']}")
    print(f"LinkedIn: {result['linkedin']}")

    print("\n──── SKILLS FOUND ────")
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
        print(f"  Title: {proj['title']}")
        print(f"  Description: {proj['description']}\n")