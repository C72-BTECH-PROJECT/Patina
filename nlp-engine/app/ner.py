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
    "exponentjs",
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

# --- Skill normalisation --------------------------------------------------------
# One canonical spelling per skill, applied to BOTH the résumé side and the job
# side before they are intersected. Without this, "Node.js" vs "nodejs",
# "REST APIs" vs "rest" vs "api", or a skill listed twice all read as distinct
# and inflate the missing-skills list.

# alias / variant -> canonical, built from SKILL_ALIASES plus the canonical keys.
_ALIAS_TO_CANONICAL = {}
for _canon, _variants in SKILL_ALIASES.items():
    _ALIAS_TO_CANONICAL[_canon.lower()] = _canon
    for _v in _variants:
        _ALIAS_TO_CANONICAL[_v.lower()] = _canon

# Variants the alias map does not cover. The GENERIC_SKILL_PATTERNS keys ("rest",
# "api") and their spelled-out forms all collapse to a single "rest api" token.
_EXTRA_NORMALISATION = {
    "rest": "rest api",
    "restful": "rest api",
    "rest api": "rest api",
    "rest apis": "rest api",
    "restful api": "rest api",
    "restful apis": "rest api",
    "api": "rest api",
    "apis": "rest api",
    "api development": "rest api",
    "ci": "ci/cd",
    "cd": "ci/cd",
    "ci cd": "ci/cd",
    "ci/cd": "ci/cd",
    "cicd": "ci/cd",
    "node": "nodejs",
    "node js": "nodejs",
    "postgres": "postgresql",
    "postgre": "postgresql",
    "k8s": "kubernetes",
    "js": "javascript",
    "ts": "typescript",
    "golang": "golang",
    "go lang": "golang",
}


def normalize_skill(raw) -> str | None:
    """Return one canonical token for a skill string, or None if it is empty."""
    if raw is None:
        return None
    s = " ".join(str(raw).split()).strip().lower()
    s = s.strip(" \t.,:;/|()[]-")
    if not s:
        return None
    if s in _EXTRA_NORMALISATION:
        return _EXTRA_NORMALISATION[s]
    if s in _ALIAS_TO_CANONICAL:
        return _ALIAS_TO_CANONICAL[s]
    return s


def normalize_skills(values) -> list:
    """Normalise an iterable of skill strings, preserving order, dropping dups."""
    out = []
    seen = set()
    for value in values or []:
        canonical = normalize_skill(value)
        if canonical and canonical not in seen:
            seen.add(canonical)
            out.append(canonical)
    return out


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

    # Defensive: the catalog has historically carried duplicate entries.
    return list(dict.fromkeys(found_skills))


# --- Résumé section model -----------------------------------------------------
# Experience, education and projects are extracted from their own section only.
# The previous approach dumped every spaCy ORG/DATE entity in the whole document
# into "experience" (so a phone number tagged DATE and acronyms like SVG/SSL
# tagged ORG became fake job history), promoted employment bullet points to
# project titles, and pulled certification lines into education. Scoping each to
# a detected heading fixes all three; a section that is genuinely absent yields
# an empty list, which is the honest result.

_CANONICAL_SECTIONS = {
    "experience": [
        "experience", "work experience", "professional experience",
        "employment", "employment history", "work history", "career history",
        "professional background", "relevant experience", "internship",
        "internships", "internship experience",
    ],
    "education": [
        "education", "academic background", "academic qualifications",
        "academic details", "educational qualifications", "qualifications",
        "education and training",
    ],
    "projects": [
        "projects", "personal projects", "academic projects", "key projects",
        "selected projects", "notable projects", "project work", "project experience",
    ],
    "skills": [
        "skills", "technical skills", "core skills", "core competencies",
        "technologies", "technical proficiencies", "tech stack", "skill set",
    ],
    "certifications": [
        "certifications", "certification", "certificates", "licenses",
        "licenses and certifications", "courses", "certifications and courses",
        "training", "professional development", "achievements and certifications",
    ],
    "summary": [
        "summary", "professional summary", "career summary", "objective",
        "career objective", "profile", "about", "about me",
    ],
    "achievements": [
        "achievements", "accomplishments", "awards", "honors", "honours",
        "awards and honors", "extracurricular", "activities",
    ],
}

_HEADING_LOOKUP = {
    phrase: canonical
    for canonical, phrases in _CANONICAL_SECTIONS.items()
    for phrase in phrases
}

_BULLET_RE = re.compile(r"^\s*(?:[-*•‣▪●◦⁃∙·–—o]\s+|\d+[.)]\s+)")

_ACTION_VERBS = {
    "engineered", "trained", "deployed", "built", "developed", "implemented",
    "designed", "created", "architected", "optimized", "optimised", "integrated",
    "migrated", "automated", "analyzed", "analysed", "researched", "improved",
    "reduced", "increased", "spearheaded", "collaborated", "utilized", "utilised",
    "leveraged", "programmed", "configured", "maintained", "refactored", "tested",
    "wrote", "added", "led", "managed", "delivered", "launched", "achieved",
    "coordinated", "mentored", "supported", "handled", "performed", "conducted",
    "assisted", "contributed", "enhanced", "streamlined",
}

_ARTICLES = {"a", "an", "the"}

_MONTH = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?"
_DATE_TOKEN = rf"(?:{_MONTH}\s*)?(?:19|20)\d{{2}}"
_DATE_RANGE_RE = re.compile(
    rf"({_DATE_TOKEN}|{_MONTH})\s*(?:-|–|—|to|through)\s*"
    rf"({_DATE_TOKEN}|present|current|now|ongoing|{_MONTH})",
    re.I,
)
_SINGLE_YEAR_RE = re.compile(r"(?<!\d)(?:19|20)\d{2}(?!\d)")

_STRONG_EDUCATION_RE = re.compile(
    r"\b(university|college|institute of technology|polytechnic|bachelor|master|"
    r"ph\.?d|b\.?tech|m\.?tech|b\.?e\b|m\.?e\b|b\.?sc|m\.?sc|bca|mca|b\.?a\b|m\.?a\b|"
    r"hsc|ssc|higher secondary|secondary school|diploma|degree|gpa|cgpa|"
    r"school of engineering)\b",
    re.I,
)


def _is_heading_line(line: str):
    """Return the canonical section a line names, or None if it is not a heading."""
    stripped = line.strip()
    if not stripped or len(stripped) > 48:
        return None
    key = re.sub(r"[^a-z& ]", "", stripped.lower()).replace("&", " and ").strip()
    key = " ".join(key.split())
    if not key:
        return None
    if key in _HEADING_LOOKUP:
        return _HEADING_LOOKUP[key]
    # "Work Experience:" / "EDUCATION —" style lines with trailing noise.
    first_three = " ".join(key.split()[:3])
    if first_three in _HEADING_LOOKUP and len(key.split()) <= 4:
        return _HEADING_LOOKUP[first_three]
    return None


def split_sections(text: str) -> dict:
    """Group résumé lines under the heading they fall beneath.

    Returns a dict of canonical-section-name -> list[str]. Lines above the first
    recognised heading land under "header". Unrecognised headings start an
    "other" bucket. Heading lines themselves are not included in any bucket.
    """
    sections = {"header": []}
    current = "header"
    for raw_line in text.split("\n"):
        line = raw_line.rstrip()
        if not line.strip():
            continue
        heading = _is_heading_line(line)
        if heading is not None:
            current = heading
            sections.setdefault(current, [])
            continue
        # An all-caps short line that is not a known heading still ends the
        # current section (it is some other section we do not model). Require
        # letters only — "GPA 8.9/10" is an education line, not a heading.
        if (
            len(line.split()) <= 4
            and re.fullmatch(r"[A-Z][A-Z &/'-]*[A-Z]", line.strip())
            and not _BULLET_RE.match(line)
            and current != "header"
        ):
            current = "other"
            sections.setdefault(current, [])
            continue
        sections.setdefault(current, []).append(line.strip())
    return sections


def _is_bullet(line: str) -> bool:
    return bool(_BULLET_RE.match(line))


def _strip_bullet(line: str) -> str:
    return _BULLET_RE.sub("", line).strip()


def _first_word(line: str) -> str:
    words = re.sub(r"[^a-zA-Z ]", " ", line).split()
    return words[0].lower() if words else ""


def _extract_date_span(line: str):
    match = _DATE_RANGE_RE.search(line)
    if match:
        return " – ".join(part.strip() for part in match.groups())
    years = _SINGLE_YEAR_RE.findall(line)
    if years:
        return years[0] if len(years) == 1 else f"{years[0]} – {years[-1]}"
    return None


_COMPANY_SUFFIX_RE = re.compile(
    r"\b(inc|inc\.|llc|ltd|ltd\.|corp|corp\.|co\.|gmbh|plc|pvt|"
    r"technologies|technology|labs|solutions|systems|software|consulting|"
    r"services|group|studios|studio|media|networks|university|college|institute)\b",
    re.I,
)


def _split_role_and_org(header: str):
    """Split a job header line into (role, organisation).

    Résumé styles vary ("Role, Company" and "Company — Role" both occur), so
    order is decided by which part looks like an organisation — a company suffix
    or a spaCy ORG entity — rather than by position.
    """
    parts = [
        p.strip(" \t,|–—-·")
        for p in re.split(r"\s{2,}|\s[|–—-]\s|,\s|\sat\s|\s@\s", header, maxsplit=1)
        if p.strip(" \t,|–—-·")
    ]
    if len(parts) != 2:
        return header.strip(" \t,|–—-·") or header, None

    ent_orgs = {e.text.strip().lower() for e in nlp(header).ents if e.label_ == "ORG"}

    def _org_score(part):
        score = 0
        if _COMPANY_SUFFIX_RE.search(part):
            score += 2
        if part.lower() in ent_orgs or any(o in part.lower() for o in ent_orgs):
            score += 1
        return score

    a, b = parts
    if _org_score(b) >= _org_score(a):
        return a, b
    return b, a


def _extract_experience(sections: dict) -> list:
    """Section-scoped work history. Empty list when there is no experience section."""
    lines = sections.get("experience")
    if not lines:
        return []

    entries = []
    for line in lines:
        if _is_bullet(line):
            if entries:
                entries[-1]["highlights"].append(_strip_bullet(line))
            continue

        date_span = _extract_date_span(line)
        header = line
        if date_span:
            header = _DATE_RANGE_RE.sub("", header)
            header = _SINGLE_YEAR_RE.sub("", header)
        header = header.strip(" \t|,-–—•:").strip()

        has_org = any(e.label_ == "ORG" for e in nlp(line).ents)
        headingish = len(line.split()) <= 12 and _first_word(line) not in _ACTION_VERBS

        if date_span or has_org or headingish:
            role, organisation = _split_role_and_org(header)
            entries.append({
                "title": role or organisation or "Role",
                "organisation": organisation,
                "dates": date_span,
                "highlights": [],
            })
        elif entries:
            entries[-1]["highlights"].append(line.strip())

    return entries


def _extract_education(sections: dict, full_text: str) -> list:
    """Education lines, scoped to the education section when one exists.

    With a real education section, a bare year or a short non-bullet line counts.
    Without one, fall back to a whole-document scan but require a strong
    degree/institution keyword — a lone year elsewhere in the résumé (a phone
    number, a project date) is not education.
    """
    section_lines = sections.get("education")
    scoped = bool(section_lines)
    candidates = section_lines if scoped else [
        ln.strip() for ln in full_text.split("\n") if len(ln.strip()) > 5
    ]

    education = []
    for line in candidates:
        clean = _strip_bullet(line) if _is_bullet(line) else line.strip()
        if len(clean) < 5 or clean in education:
            continue
        if _STRONG_EDUCATION_RE.search(clean):
            education.append(clean)
        elif scoped and not _is_bullet(line) and len(clean.split()) <= 14:
            # Inside a real education section: keep entry lines (institution
            # names, "2019 – 2023") even without a keyword; drop stray bullets.
            education.append(clean)
    return education


def _looks_like_project_title(line: str) -> bool:
    stripped = line.strip()
    if not stripped or _is_bullet(line) or stripped.endswith("."):
        return False
    first = _first_word(stripped)
    if first in _ACTION_VERBS or first in _ARTICLES:
        return False
    # "Title | React, Node"  /  "Title — stack"  /  "Title: description".
    # A plain hyphen is deliberately excluded — it collides with date ranges
    # ("Project Lead, Initech 2019 - 2021" is a job header, not a project).
    if _extract_date_span(stripped):
        return False
    if re.match(r"^[A-Za-z0-9][^|]{1,70}\s[|–—:]\s*\S", stripped):
        return True
    return False


def _extract_projects(sections: dict, full_text: str) -> list:
    """Projects, scoped to the projects section.

    A line becomes a title only if it matches a title pattern, or is a short
    heading-like line immediately followed by a bullet. Employment-style bullet
    points and sentences starting with an action verb attach to the current
    project's description instead of becoming their own project.
    """
    section_lines = sections.get("projects")
    if section_lines:
        lines = section_lines
        scoped = True
    else:
        lines = [ln.strip() for ln in full_text.split("\n") if len(ln.strip()) > 5]
        scoped = False

    projects = []

    def _add_desc(text_line):
        if projects and text_line:
            projects[-1]["description"].append(text_line)

    for idx, line in enumerate(lines):
        if _is_bullet(line):
            _add_desc(_strip_bullet(line))
            continue
        if _first_word(line) in _ACTION_VERBS:
            _add_desc(line.strip())
            continue

        next_is_bullet = idx + 1 < len(lines) and _is_bullet(lines[idx + 1])
        heading_like = (
            len(line.split()) <= 8
            and not line.strip().endswith(".")
            and _first_word(line) not in _ACTION_VERBS
            and _first_word(line) not in _ARTICLES
        )

        if scoped:
            is_title = _looks_like_project_title(line) or (heading_like and next_is_bullet)
        else:
            # No projects section: only a clear "Name | Tech" style line that
            # also names a project counts. The heading-then-bullet path is too
            # loose to use against the whole document (it catches job headers).
            is_title = _looks_like_project_title(line) and bool(
                re.search(r"\bproject\b", line.lower())
            )

        if is_title:
            title = re.sub(r"^[\W_]+", "", line).strip().rstrip(":").strip()
            if title and not any(p["title"].lower() == title.lower() for p in projects):
                projects.append({"title": title, "description": []})
        elif projects:
            _add_desc(line.strip())

    return [
        {"title": p["title"], "description": " · ".join(p["description"]).strip(" ·")}
        for p in projects
    ]


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

    # ── 2-4. SECTION-SCOPED ENTITIES ─────────────────────
    sections = split_sections(text)
    experience = _extract_experience(sections)
    education = _extract_education(sections, text)
    projects = _extract_projects(sections, text)

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
        print(f"  {item['title']} @ {item['organisation']} ({item['dates']})")
        for highlight in item["highlights"]:
            print(f"    - {highlight}")

    print("\n──── EDUCATION ────")
    for edu in result["education"]:
        print(f"  {edu}")

    print("\n──── PROJECTS ────")
    for proj in result["projects"]:
        print(f"  Title: {proj['title']}")
        print(f"  Description: {proj['description']}\n")
