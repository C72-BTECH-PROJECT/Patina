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
    "devops", "ci/cd", "mern stack",

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
    "html", "css", "sass", "microservices",
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

# Store one canonical value for variants that appear frequently in resumes and
# job descriptions.  This improves recall without changing the API response.
SKILL_ALIASES = {
    "javascript": ("javascript", "java script", "js"),
    "typescript": ("typescript", "type script", "ts"),
    "nodejs": ("nodejs", "node.js", "node js"),
    "nextjs": ("nextjs", "next.js", "next js"),
    "nuxtjs": ("nuxtjs", "nuxt.js", "nuxt js"),
    "react": ("react", "react.js", "reactjs"),
    "vue": ("vue", "vue.js", "vuejs"),
    "angular": ("angular", "angularjs", "angular.js"),
    "postgresql": ("postgresql", "postgres", "postgre sql"),
    "mongodb": ("mongodb", "mongo db", "mongo"),
    "scikit-learn": ("scikit-learn", "scikit learn", "sklearn"),
    "pytorch": ("pytorch", "py torch"),
    "c#": ("c#", "c sharp", "csharp"),
    "c++": ("c++", "cpp", "c plus plus"),
    ".net": (".net", "dotnet", "dot net"),
}

# These words occur in ordinary prose, so only accept clear technical forms.
GENERIC_SKILL_PATTERNS = {
    "rest": r"(?<![a-z])rest(?:ful)?\s*(?:api|apis|service|services)(?![a-z])",
    "api": r"\bapis?\b",
    "agile": r"\bagile\s*(?:methodology|development|team|environment|practices?)\b",
    "scrum": r"\b(?:scrum|scrum master|sprint planning)\b",
    "oop": r"\b(?:oop|object[ -]oriented programming)\b",
}


def extract_skills(text: str) -> list:
    """Return ordered, canonical skills found in text."""
    text_lower = text.lower()
    found_skills = []

    for skill in SKILL_KEYWORDS:
        aliases = SKILL_ALIASES.get(skill, (skill,))
        if any(re.search(r'(?<!\w)' + re.escape(alias) + r'(?!\w)', text_lower) for alias in aliases):
            found_skills.append(skill)

    for skill, pattern in GENERIC_SKILL_PATTERNS.items():
        if re.search(pattern, text_lower) and skill not in found_skills:
            found_skills.append(skill)

    # Skills supported by aliases but not yet present in the original catalog.
    for skill, aliases in SKILL_ALIASES.items():
        if skill not in found_skills and any(
            re.search(r'(?<!\w)' + re.escape(alias) + r'(?!\w)', text_lower)
            for alias in aliases
        ):
            found_skills.append(skill)

    return found_skills


def is_plausible_organisation(value: str) -> bool:
    """Reject resume headings, skills and qualifications mislabeled as ORG."""
    normalized = " ".join(value.split()).strip()
    lowered = normalized.lower()
    non_organisation_terms = {
        *SKILL_KEYWORDS,
        *SKILL_ALIASES.keys(),
        "phone", "email", "linkedin", "github", "concepts", "skills",
        "technical skills", "cloud & devops", "computer engineering",
        "bachelor of technology", "b.tech", "master of technology", "m.tech",
        "college name", "university name", "education", "experience",
        "projects", "certifications", "maven concepts", "mern", "mern stack",
        "crud", "ec2", "vpc", "ecr", "eks", "ci",
    }

    # Multi-line entities commonly span neighbouring resume headings/bullets,
    # rather than being a company name.
    if "\n" in value or lowered in non_organisation_terms:
        return False
    if any(term in lowered for term in ("data structures", "algorithms", "database design", "system design")):
        return False
    if lowered in {alias for aliases in SKILL_ALIASES.values() for alias in aliases}:
        return False
    if lowered in extract_skills(normalized):
        return False
    return len(normalized) >= 2

def extract_entities(text: str) -> dict:
    doc = nlp(text)

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
    found_skills = extract_skills(text)

    # ── 2. EXPERIENCE ────────────────────────────────────
    experience = []
    seen_organisations = set()
    for ent in doc.ents:
        if ent.label_ == "ORG":
            value = ent.text.strip()
            key = " ".join(value.lower().split())
            if is_plausible_organisation(value) and key not in seen_organisations:
                experience.append({
                    "type": "organisation",
                    "value": value
                })
                seen_organisations.add(key)
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
    projects = []
    in_projects_section = False
    
    i = 0
    while i < len(lines):
        line = lines[i]
        line_lower = line.lower()
        # Action verbs alone are not project evidence: employment bullets also
        # contain "developed" and "implemented".  Require a Projects heading
        # or an explicit project reference instead.
        looks_like_heading = len(line.split()) <= 5 and (
            line.isupper() or line.endswith(":")
        )
        if looks_like_heading:
            in_projects_section = "project" in line_lower
            i += 1
            continue

        is_project = in_projects_section or bool(
            re.search(r'\b(?:project|capstone|personal project)\b', line_lower)
        )
        
        if is_project:
            # Clean bullet points from title
            title = re.sub(r'^[\W_]+', '', line).strip()
            
            # Grab next few lines for description
            description_lines = []
            j = i + 1
            while j < len(lines) and j < i + 4:
                desc_line = lines[j]
                # Break if next line looks like a new section heading
                if len(desc_line.split()) < 3 and (desc_line.isupper() or desc_line.endswith(":")):
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
