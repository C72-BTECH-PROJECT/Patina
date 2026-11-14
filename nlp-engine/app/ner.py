import spacy
import re
import os

nlp = spacy.load("en_core_web_sm")

# R-21 (DECISIONS 4.2, I-0004). Removed: "github" (a hosting site, not a skill;
# it came from profile URLs and from the label "GitHub" beside a link),
# "exponentjs" (not a real library) and "r language" (R is detected below).
# "c", "go" and "r", and the English words express, spring, oracle, apache and
# rust, are listed in catalog order but matched by the context rules of
# CONTEXT_SKILLS, never as a bare word anywhere.
SKILL_KEYWORDS = [
    # programming languages
    "python", "java", "javascript", "typescript", "go", "c",
    "ruby", "rust", "swift", "kotlin", "php", "scala",
    "matlab", "perl", "bash", "dart", "lua", "r", "powershell",

    # web frameworks and libraries
    "react", "angular", "vue", "nextjs", "nuxtjs", "nodejs", "express",
    "django", "flask", "fastapi", "spring boot", "spring", "laravel", "rails",
    "jquery", "bootstrap", "tailwind", "redux", "graphql", "webpack",
    "vite", "gatsby", "svelte", "remix",

    # databases
    "mongodb", "mysql", "postgresql", "sqlite", "redis", "firebase",
    "cassandra", "elasticsearch", "dynamodb", "oracle", "mariadb",
    "neo4j", "couchdb", "supabase", "prisma", "sequelize", "mongoose",

    # cloud and devops
    "aws", "azure", "gcp", "docker", "kubernetes", "jenkins", "git",
    "gitlab", "bitbucket", "linux", "terraform", "ansible",
    "nginx", "apache", "heroku", "vercel", "netlify", "cloudflare",
    "digitalocean", "circleci", "tomcat", "grunt", "maven",
    "devops", "ci/cd", "mern stack",

    # IT support and operations (R-21, GF-3): service management and ticketing,
    # monitoring, and Windows / Microsoft administration.
    "servicenow", "jira", "itil", "bmc remedy", "zendesk", "freshservice",
    "freshdesk", "pagerduty",
    "nagios", "zabbix", "prometheus", "grafana", "splunk", "datadog",
    "cloudwatch",
    "active directory", "windows server", "group policy", "sccm", "intune",
    "exchange server", "office 365", "vmware", "hyper-v",

    # data science and ml
    "tensorflow", "pytorch", "keras", "scikit-learn", "pandas", "numpy",
    "matplotlib", "seaborn", "opencv", "nlp", "machine learning",
    "deep learning", "computer vision", "data science", "jupyter",
    "spark", "hadoop", "airflow", "mlflow", "transformers", "bert",
    "langchain", "openai", "hugging face",
    # 2.3.0 (owner decision 2026-11-14, ISSUES R-32 entry): "sas" is matched as a
    # word anywhere; "statistics" is an ordinary English word, so it is a context
    # skill (CONTEXT_SKILLS) and needs a technical context.
    "sas", "statistics",

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
    "spring boot": ("spring boot", "springboot", "spring-boot"),
    "powershell": ("powershell", "power shell"),
    "servicenow": ("servicenow", "service now", "service-now"),
    "itil": ("itil", "itil4", "itilv3", "itilv4"),
    "windows server": ("windows server", "windows servers"),
    "office 365": ("office 365", "office365", "microsoft 365", "o365", "m365"),
    "cloudwatch": ("cloudwatch", "cloud watch"),
    "exchange server": ("exchange server", "microsoft exchange", "exchange online"),
    "sccm": ("sccm", "mecm", "system center configuration manager",
             "microsoft endpoint configuration manager"),
    "hyper-v": ("hyper-v", "hyperv"),
    "bmc remedy": ("bmc remedy", "remedyforce"),
    # Spellings of the context skills below. They are used to normalise skill
    # names (job side) and by the similarity evidence search; extract_skills
    # never matches them as bare words, only through CONTEXT_SKILLS.
    "go": ("go", "golang", "go lang", "go language"),
    "c": ("c", "c language", "c programming"),
    "r": ("r", "r language", "r programming"),
    "express": ("express", "express.js", "expressjs", "express js"),
    "spring": ("spring", "spring framework"),
    "oracle": ("oracle", "oracle database", "oracle db"),
    "apache": ("apache", "apache http server", "apache httpd", "apache2"),
    "rust": ("rust", "rustlang", "rust language"),
}

# --- Context skills (R-21) --------------------------------------------------------
# A skill whose bare name is also an English word ("express", "spring", "oracle",
# "apache", "rust") or a single letter or short word ("c", "go", "r") is found
# only when:
#   1. one of its `context` patterns matches (an unambiguous spelling or a
#      technical neighbour: "Express.js", "Spring MVC", "Oracle 19c", "C/C++",
#      "written in Go"), or
#   2. its bare name (`bare`, full match) is a whole item of a list on one line
#      ("Java, Spring, SQL", "Languages: C, Go, R") and that line is in the
#      skills section or another short item of it names a skill.
# Patterns run on the original-case text; a pattern that must ignore case says
# so with (?i:...). "C", "Go" and "R" as list items are case-sensitive.
_BUILT_IN = (r"\b(?i:written|writ(?:e|ing)|wrote|implemented|built|developed|coded|programmed|"
             r"rewritten|rewrote)\s+(?:[\w-]+\s+){0,3}in\s+")
CONTEXT_SKILLS = {
    "go": {
        "bare": r"(?:Go|GO|go)",
        "context": [
            r"(?i:\bgolang\b|\bgo[\s-]?lang\b|\bgo\s+(?:language|programming)\b)",
            _BUILT_IN + r"Go\b(?![-'’])",
            r"\bGo\s+(?:developer|engineer|programmer|backend|microservices?)\b",
        ],
    },
    "c": {
        "bare": r"C",
        "context": [
            r"(?<![\w.+#/-])C(?=\s*(?:/|,|&|and)\s*C\+\+)",
            r"(?<![\w.+#/-])C\s+(?i:programming|language)\b",
            r"(?i:\b(?:embedded|ansi))\s+C(?![\w+#.-])",
            _BUILT_IN + r"C(?![\w+#.-])",
        ],
    },
    "r": {
        "bare": r"R",
        "context": [
            r"(?<![\w.&-])R\s+(?i:programming|language|studio|shiny)\b",
            r"(?i:\brstudio\b)",
            r"\b(?:in|using)\s+R(?=\s*(?:,|\(|and\b|or\b|to\b|for\b|with\b|$))",
        ],
    },
    "express": {
        "bare": r"(?i:express)",
        "context": [
            r"(?i:\bexpress(?:\.js|js)(?!\w)|\bexpress\s+js\b)",
            r"(?i:\bexpress\s+(?:apis?|servers?|middleware|apps?|application|routes?|routing|"
            r"backend|back-end|framework|rest)\b)",
            r"(?i:\bnode(?:\.js|js)?\s*(?:/|\+|&|and)\s*express\b)",
            # "with Express" capitalised, not a delivery service ("with Express Delivery").
            r"\b(?:with|using|used|in|on)\s+Express\b(?![\w.-]|\s+(?:Delivery|Mail|Entry|Shipping))",
        ],
    },
    "spring": {
        "bare": r"(?i:spring)",
        "context": [
            r"(?i:\bspring\s+(?:framework|mvc|security|cloud|data|batch|webflux|jpa|integration|aop|core)\b)",
        ],
    },
    "oracle": {
        "bare": r"(?i:oracle)",
        "context": [
            r"(?i:\boracle\s+(?:databases?|db|dba|sql|pl/sql|rac|asm|rman|exadata|data\s*guard|"
            r"\d{1,2}[gc])(?!\w))",
        ],
    },
    "apache": {
        "bare": r"(?i:apache)",
        "context": [
            r"(?i:\bapache\s*(?:http(?:d)?(?:\s+server)?|web\s+server|server)\b|\bapache2\b)",
        ],
    },
    "rust": {
        "bare": r"(?i:rust)",
        "context": [
            r"(?i:\brustlang\b|\brust\s*(?:lang|language|programming)\b)",
            _BUILT_IN + r"Rust\b",
        ],
    },
    # "statistics" in prose ("Bureau of Labor Statistics", "sales statistics") is
    # not a skill. Found when it is a list item (rule 2), a named branch of the
    # field, or tied to a statistical tool.
    "statistics": {
        # A sentence-final period is allowed: "SAS, R and statistics."
        "bare": r"(?i:statistics)\.?",
        "context": [
            r"(?i:\b(?:applied|bayesian|inferential|mathematical|computational|multivariate)\s+statistics\b)",
            r"(?i:\bstatistics\s+(?:with|using|in)\s+(?:r|python|sas|spss|stata|matlab)\b)",
        ],
    },
}

# These words occur in ordinary prose, so only accept clear technical forms.
# "api": a bare "API" ("worked with the API team") is not a skill; it needs a
# technical qualifier, a known framework before it, a following technical noun,
# or a build verb before it.
GENERIC_SKILL_PATTERNS = {
    "rest": r"(?<![a-z])rest(?:ful)?\s*(?:api|apis|service|services)(?![a-z])",
    "api": (
        r"\b(?:rest(?:ful)?|web|graphql|soap|http|json|third[- ]party|public|internal|backend|"
        r"back-end|external|partner|payment|private|express|django|flask|fastapi|spring(?: boot)?|"
        r"node(?:\.js|js)?|laravel|rails)\s+apis?\b"
        r"|\bapis?\s+(?:development|design|integrations?|gateway|testing|endpoints?|documentation|"
        r"management|security|calls?|layer|clients?|services?)\b"
        r"|\b(?:built|designed|developed|wrote|written|implemented|exposed|consumed|integrated|"
        r"documented|maintained|created)\s+(?:\w+\s+){0,2}apis?\b"
    ),
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
    "go programming": "go",
    "apache http": "apache",
    "apache web server": "apache",
    "oracle sql": "oracle",
    "jira software": "jira",
    "jira service management": "jira",
    "jira service desk": "jira",
    "itil v3": "itil",
    "itil v4": "itil",
    "itil 4": "itil",
    "aws cloudwatch": "cloudwatch",
    "amazon cloudwatch": "cloudwatch",
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


def _alias_regex(skill: str, alias: str) -> str:
    # Not after a letter, digit or dot: the "js" of "Node.js" is not
    # JavaScript and the "html" of "index.html" is not a skill (R-21).
    pattern = r"(?<![\w.])" + re.escape(alias) + r"(?!\w)"
    if alias == "js":
        # Nor the "JS" of "Node JS", "React JS" ...: those name the framework.
        pattern = "".join(rf"(?<!{w} )" for w in ("node", "react", "next", "nuxt", "vue", "express")) + pattern
    if skill == "java":
        pattern += r"(?!\s*-?\s*script)"  # "Java Script" is JavaScript only
    return pattern


# Skills matched anywhere by their spellings (every skill except the context ones).
_ANYWHERE_RE = {}
for _skill in list(SKILL_KEYWORDS) + [s for s in SKILL_ALIASES if s not in SKILL_KEYWORDS]:
    if _skill in CONTEXT_SKILLS or _skill in _ANYWHERE_RE:
        continue
    _ANYWHERE_RE[_skill] = re.compile(
        "|".join(_alias_regex(_skill, a) for a in SKILL_ALIASES.get(_skill, (_skill,)))
    )

_CONTEXT_RE = {
    skill: (re.compile(rf"\s*{rule['bare']}\s*"), [re.compile(p, re.M) for p in rule["context"]])
    for skill, rule in CONTEXT_SKILLS.items()
}
_GENERIC_RE = {skill: re.compile(p) for skill, p in GENERIC_SKILL_PATTERNS.items()}

# One line's list items: split on commas, semicolons, pipes, bullets, slashes,
# brackets, " - ", "and" / "&", and a "Label:" prefix.
_LIST_ITEM_SPLIT_RE = re.compile(r"[,;|•·/()\[\]]|\s[-–—]\s|\s(?:and|&)\s|:\s")


def _skill_text(text: str) -> str:
    """The text skills are read from: links and email addresses are removed, so
    a profile URL ("github.com/...", "gitlab.com/...") never yields a skill."""
    return _URL_RE.sub(" ", _EMAIL_RE.sub(" ", text))


def _list_context_skills(text: str) -> set:
    """Context skills named as a whole list item (rule 2 of CONTEXT_SKILLS)."""
    skills_lines = {line.strip() for line in split_sections(text).get("skills", [])}
    found = set()
    for line in text.split("\n"):
        items = [i.strip() for i in _LIST_ITEM_SPLIT_RE.split(line) if i.strip()]
        if len(items) < 2 and line.strip() not in skills_lines:
            continue
        for skill, (bare, _) in _CONTEXT_RE.items():
            if skill in found:
                continue
            hits = [i for i, item in enumerate(items) if bare.fullmatch(item)]
            if not hits:
                continue
            if line.strip() in skills_lines or any(
                k not in hits and len(item.split()) <= 4
                and any(rx.search(item.lower()) for rx in _ANYWHERE_RE.values())
                for k, item in enumerate(items)
            ):
                found.add(skill)
    return found


def extract_skills(text: str) -> list:
    """Return ordered, canonical skills found in text.

    Catalog order, then the generic patterns, then alias-only skills. Context
    skills (CONTEXT_SKILLS) need a technical context; links and emails are
    ignored (R-21).
    """
    skill_text = _skill_text(text)
    text_lower = skill_text.lower()
    listed = _list_context_skills(skill_text)
    found_skills = []

    def _found(skill):
        if skill in _CONTEXT_RE:
            return skill in listed or any(rx.search(skill_text) for rx in _CONTEXT_RE[skill][1])
        return bool(_ANYWHERE_RE[skill].search(text_lower))

    for skill in SKILL_KEYWORDS:
        if _found(skill):
            found_skills.append(skill)

    for skill, rx in _GENERIC_RE.items():
        if skill not in found_skills and rx.search(text_lower):
            found_skills.append(skill)

    # Skills supported by aliases but not in the catalog list (c#, c++, .net ...).
    for skill in SKILL_ALIASES:
        if skill not in found_skills and skill not in SKILL_KEYWORDS and _found(skill):
            found_skills.append(skill)

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

# --- Education entry fields (R-30) ---------------------------------------------
# One entry per qualification: the institution, degree, dates, graduation year,
# grade (CGPA, GPA or percentage) and honours found on the lines of that
# qualification, however many lines it is written over.

_DEGREE_RE = re.compile(
    r"\b(?:bachelor(?:'?s)?|master(?:'?s)?|doctor(?:ate)?\b|ph\.?\s?d|"
    r"b\.?\s?tech|m\.?\s?tech|b\.?\s?sc|m\.?\s?sc|b\.?\s?com|m\.?\s?com|b\.?\s?eng|m\.?\s?eng|"
    r"b\.\s?e\.?|m\.\s?e\.?|b\.\s?s\.?|m\.\s?s\.?|b\.\s?a\.?|m\.\s?a\.?|"
    r"bca|mca|bba|mba|hnd|hsc|ssc|higher secondary|senior secondary|"
    r"secondary school certificate|diploma|associate(?:'?s)? degree|degree|"
    r"class\s+(?:x|xii|10|12)(?:th)?|(?:10|12)th\b|a[- ]levels?|gcse|cbse|icse)(?!\w)",
    re.I,
)
# Bare two-letter degree acronyms only in capitals ("BE", "MS"), so the words
# "be", "ms" or "ma" in a sentence are not read as degrees.
_DEGREE_ACRONYM_RE = re.compile(r"\b(?:BE|ME|BS|MS|BA|MA|BSc|MSc|BTech|MTech|BCom|MCom|PhD)\b")
_INSTITUTION_RE = re.compile(
    r"\b(?:universit(?:y|ies)|universität|college|institute|institution|polytechnic|"
    r"school|academy|vidyalaya|vidyapeeth|iit|nit|iiit|bits)\b",
    re.I,
)
_GRADE_RE = re.compile(
    r"\b(?:c\.?g\.?p\.?a|g\.?p\.?a|cgpi|cpi|sgpa)\b\.?\s*(?:of\s+)?[:=\-–]?\s*"
    r"\d{1,2}(?:\.\d{1,3})?(?:\s*/\s*\d{1,2}(?:\.\d{1,2})?)?"
    r"|\b\d{1,2}(?:\.\d{1,3})?(?:\s*/\s*\d{1,2}(?:\.\d{1,2})?)?\s*(?:c\.?g\.?p\.?a|g\.?p\.?a|cgpi|cpi)\b"
    r"|\b(?:percentage|aggregate|marks|score)\b\s*[:\-–]?\s*\d{1,3}(?:\.\d{1,2})?\s*%?"
    r"|\b\d{1,3}(?:\.\d{1,2})?\s*%",
    re.I,
)
_HONOURS_RE = re.compile(
    r"\b(?:honou?rs?|with distinction|distinction|first class|first division|"
    r"(?:summa |magna )?cum laude|dean'?s list|gold medal(?:ist)?|rank holder|minor in)\b",
    re.I,
)
_EDU_NOISE_RE = re.compile(r"\b(?:expected|graduat(?:ed|ing|ion)|class of|batch of|passed out|passing year)\b:?", re.I)
_EDU_PART_SPLIT_RE = re.compile(r"\s+[|–—-]\s+|\s*\|\s*|,\s+|\s+at\s+|\s+@\s+|\t|\s{2,}")


def _has_degree(text: str) -> bool:
    return bool(_DEGREE_RE.search(text) or _DEGREE_ACRONYM_RE.search(text))


def _parse_education_line(line: str) -> dict:
    """The fields one education line carries. Missing fields are None."""
    info = {"degree": None, "institution": None, "honours": None, "grade": None,
            "dates": None, "years": [], "open_ended": False, "other": None}
    body = line
    grade = _GRADE_RE.search(body)
    if grade:
        info["grade"] = grade.group().strip()
        body = body[:grade.start()] + " " + body[grade.end():]

    span = _DATE_RANGE_RE.search(body)
    if span:
        info["dates"] = " – ".join(part.strip() for part in span.groups())
        info["years"] = [int(y) for y in _SINGLE_YEAR_RE.findall(span.group())]
        info["open_ended"] = bool(re.search(r"present|current|now|ongoing", span.group(2), re.I))
        body = body[:span.start()] + " " + body[span.end():]
    years = [int(y) for y in _SINGLE_YEAR_RE.findall(body)]
    if years:
        info["years"] += years
        info["dates"] = info["dates"] or (str(years[0]) if len(years) == 1 else f"{years[0]} – {years[-1]}")
        body = _SINGLE_YEAR_RE.sub(" ", body)
    body = _EDU_NOISE_RE.sub(" ", body)
    body = re.sub(r"\(\s*[-–—,|]*\s*\)", " ", body)          # "()" left by a removed date
    body = " ".join(body.split()).strip(" \t|,;:-–—·•")

    if not body:
        return info

    honours = _HONOURS_RE.search(body)
    if honours and not _has_degree(body) and not _INSTITUTION_RE.search(body):
        info["honours"] = body
        return info
    if honours:
        info["honours"] = honours.group()

    current = None
    for part in (p.strip(" \t|,;:-–—·•") for p in _EDU_PART_SPLIT_RE.split(body)):
        if not part:
            continue
        if _has_degree(part) and info["degree"] is None:
            info["degree"], current = part, "degree"
        elif _INSTITUTION_RE.search(part) and info["institution"] is None:
            info["institution"], current = part, "institution"
        elif current:
            info[current] = f"{info[current]}, {part}"
        else:
            info["other"] = f"{info['other']}, {part}" if info["other"] else part
    if info["other"] and current is None:
        return info
    if info["other"]:
        # Text before the first recognised part ("Pune, B.Tech ...") stays in the entry text only.
        info["other"] = None
    return info


def _new_education_entry() -> dict:
    return {"institution": None, "degree": None, "dates": None, "graduation_year": None,
            "grade": None, "honours": None, "_lines": [], "_years": [], "_open": False}


def _merge_education_line(entry: dict, info: dict, line: str) -> None:
    entry["_lines"].append(line)
    for field in ("institution", "degree", "grade"):
        if info[field] and not entry[field]:
            entry[field] = info[field]
    if info["honours"]:
        entry["honours"] = f"{entry['honours']}; {info['honours']}" if entry["honours"] else info["honours"]
    if info["dates"] and not entry["dates"]:
        entry["dates"] = info["dates"]
    entry["_years"] += info["years"]
    entry["_open"] = entry["_open"] or info["open_ended"]


def _finish_education_entry(entry: dict) -> dict:
    graduation_year = None
    if entry["_years"] and not entry["_open"]:
        graduation_year = max(entry["_years"])
    return {
        "institution": entry["institution"],
        "degree": entry["degree"],
        "dates": entry["dates"],
        "graduation_year": graduation_year,
        "grade": entry["grade"],
        "honours": entry["honours"],
        "text": " · ".join(entry["_lines"]),
    }


def _group_education(lines) -> list:
    """Group the lines of an education section into one entry per qualification.

    A line starts a new entry when it names a degree and the current entry has
    one already, names an institution and the current entry has one already, or
    is a date line and the current entry has dates already. A line that only
    carries honours, a grade or dates is attached to the current entry. Bullets
    only add a grade or honours, never a new qualification.
    """
    entries = []
    current = None
    for raw in lines:
        bullet = _is_bullet(raw)
        line = _strip_bullet(raw) if bullet else raw.strip()
        if len(line) < 2:
            continue
        info = _parse_education_line(line)
        if bullet:
            info.update(degree=None, institution=None, other=None)
            if current is not None:
                _merge_education_line(current, info, line)
            continue

        only_other = info["other"] and not (info["degree"] or info["institution"])
        if only_other:
            # An unrecognised short line: an institution the keywords do not
            # know ("Example State", "St. Mary's") if the entry has none yet.
            if current is None or current["institution"] is None:
                if len(line.split()) <= 10 and not line.endswith("."):
                    info["institution"] = info["other"]
        starts_new = current is None or (
            (info["degree"] and current["degree"])
            or (info["institution"] and current["institution"])
            or (info["dates"] and current["dates"] and not (info["degree"] or info["institution"]))
        )
        if info["honours"] and not info["institution"] and current is not None and current["degree"]:
            # "B.Tech Honours in AI" under a degree already found is the honours
            # of that degree, not a second qualification.
            starts_new = False
            if info["degree"]:
                info["honours"] = line
                info["degree"] = None
        if starts_new:
            current = _new_education_entry()
            entries.append(current)
        _merge_education_line(current, info, line)
    return [_finish_education_entry(e) for e in entries]


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


_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def _is_contact_only(line: str) -> bool:
    """A line made only of links, email addresses and phone numbers: once the
    links and emails are removed, no letter is left."""
    stripped = line.strip()
    rest = _URL_RE.sub(" ", _EMAIL_RE.sub(" ", stripped))
    if re.search(r"[^\W\d_]", rest):
        return False
    return rest.strip() != stripped or len(re.sub(r"\D", "", rest)) >= 7


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
        if _is_contact_only(line):
            # A page footer read after the body ("linkedin.com/in/...") is not a job.
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
    """One entry per qualification, scoped to the education section.

    Each entry is {institution, degree, dates, graduation_year, grade, honours,
    text}; `text` is the entry's source lines joined with " · ". With a real
    education section its lines are grouped into qualifications however many
    lines each is written over (`_group_education`). Without one, fall back to
    a whole-document scan where each line with a strong degree/institution
    keyword is its own entry: a lone year elsewhere in the résumé (a phone
    number, a project date) is not education.
    """
    section_lines = sections.get("education")
    if section_lines:
        return _group_education(section_lines)

    entries, seen = [], set()
    for raw in full_text.split("\n"):
        line = _strip_bullet(raw) if _is_bullet(raw) else raw.strip()
        if len(line) < 5 or line in seen or not _STRONG_EDUCATION_RE.search(line):
            continue
        seen.add(line)
        entries.extend(_group_education([line]))
    return entries


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


# --- Candidate name (R-30) -----------------------------------------------------
# The name is read from the top lines first: the words before the first contact
# token (a phone digit, "+91", an email, a URL) or separator. spaCy's first
# PERSON entity is the fallback, cut the same way. A name never contains a
# digit, "+", "@", "/", ":" or a URL.

_NAME_SEPARATOR_RE = re.compile(r"\s*(?:[|•·,;\t]|\s{2,}|\s[-–—]\s)\s*")
_CONTACT_TOKEN_RE = re.compile(r"[\d@+/\\:()]|^(?:https?|www)\b|\.(?:com|in|org|net|io|dev|me|co)\b", re.I)
_NAME_WORD_RE = re.compile(r"^[^\W\d_](?:[^\W\d_]|['’.\-])*$")
_NAME_LABEL_RE = re.compile(r"^\s*(?:full\s+)?name\s*[:\-]\s*", re.I)
_NOT_NAME_WORDS = {
    "resume", "résumé", "curriculum", "vitae", "cv", "biodata", "bio", "contact", "email",
    "e-mail", "phone", "mobile", "tel", "address", "linkedin", "github", "portfolio",
    "profile", "summary", "objective", "engineer", "developer", "manager", "analyst",
    "intern", "consultant", "designer", "architect", "scientist", "student", "specialist",
    "administrator", "lead", "senior", "junior", "software", "support", "page",
}


def _name_words(fragment: str) -> list:
    """Leading name-like words of a fragment, stopping at the first contact token."""
    words = []
    for token in fragment.split():
        if _CONTACT_TOKEN_RE.search(token) or not _NAME_WORD_RE.match(token):
            break
        words.append(token)
    return words


def _plausible_name(words: list) -> str | None:
    if not 2 <= len(words) <= 5:
        return None
    if any(w.lower().strip(".") in _NOT_NAME_WORDS for w in words):
        return None
    if not all(w[0].isupper() for w in words):
        return None
    name = " ".join(words)
    if _is_heading_line(name) or extract_skills(name):
        return None
    return name


def _candidate_name(header_lines, doc) -> str | None:
    for line in header_lines[:3]:
        fragment = _NAME_SEPARATOR_RE.split(_NAME_LABEL_RE.sub("", line.strip()), maxsplit=1)[0]
        name = _plausible_name(_name_words(fragment))
        if name:
            return name
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            words = _name_words(" ".join(ent.text.split()))
            if len(words) >= 2:
                return " ".join(words)
    return None


# --- Links (R-30) ---------------------------------------------------------------
# Every web link written in the text, in order, plus the link targets attached
# to words in the file (`links` argument), after them. Bare domains count only
# with a common top-level domain and a second-level label of 2+ characters, so
# "B.Tech", "B.Com", "Node.js", "socket.io" and "ASP.NET" are not links.

_URL_STOP = r"[^\s<>()\[\]{}|,;\"'“”‘’]"
_BARE_TLD = r"(?:com|org|dev|me|in|co|app|page|site|tech|xyz|blog|info|us|uk|eu|de|ca|au|edu|gov|link|pro|online|website)"
_PATH_TLD = r"(?:net|io|ai|so|sh|gg|ly|to|tv|cc)"
_URL_RE = re.compile(
    rf"(?<![@\w./-])(?:"
    rf"(?:https?://|www\.){_URL_STOP}+"
    rf"|(?:[a-z0-9][a-z0-9-]*\.)*[a-z0-9][a-z0-9-]+\.{_BARE_TLD}(?:/{_URL_STOP}*)?(?![\w@])"
    rf"|(?:[a-z0-9][a-z0-9-]*\.)*[a-z0-9][a-z0-9-]+\.{_PATH_TLD}/{_URL_STOP}*"
    rf")",
    re.I,
)


def _link_key(url: str) -> str:
    key = re.sub(r"(?i)^https?://", "", url.strip())
    key = re.sub(r"(?i)^www\.", "", key)
    return key.rstrip("/").lower()


def _collect_links(text: str, link_targets) -> list:
    out, seen = [], set()

    def _add(url):
        url = url.rstrip(".,;:!?)]}'\"")
        if not url or "." not in url:
            return
        key = _link_key(url)
        if key and key not in seen:
            seen.add(key)
            out.append(url)

    for match in _URL_RE.finditer(text):
        _add(match.group())
    for target in link_targets or ():
        _add(target)
    return out


def extract_entities(text: str, links=()) -> dict:
    """Entities of a résumé's text.

    `links` are link targets attached to words in the file (PDF annotations,
    DOCX hyperlinks). They are read only by the contact parser (GitHub,
    LinkedIn, the `links` list), after the text's own matches, and never added
    to the text, so skills, sections and similarity do not depend on them.
    """
    links = [l for l in (links or ()) if isinstance(l, str) and l.strip()]
    doc = nlp(text)
    sections = split_sections(text)

    # ── 0. CANDIDATE NAME ────────────────────────────────
    candidate_name = _candidate_name(sections.get("header", []), doc)

    # ── 1. SKILLS — word boundary matching ──────────────
    found_skills = extract_skills(text)

    # ── 2-4. SECTION-SCOPED ENTITIES ─────────────────────
    experience = _extract_experience(sections)
    education = _extract_education(sections, text)
    projects = _extract_projects(sections, text)

    # ── 5. REGEX EXTRACTIONS (Email, Phone, Links) ───────
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    phone_pattern = r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
    # Group 1 = scheme/host prefix, 2 = owner, 3 = optional "/repo" segment (T-0013, I-0015).
    github_pattern = r'((?:https?://)?(?:www\.)?(?i:github)\.com/)([A-Za-z0-9_.-]+)(/[A-Za-z0-9_.-]*)?'
    # Any case ("LinkedIn.com"), a country subdomain ("in.linkedin.com"), /in/ or
    # /pub/, and any slug character a URL can carry (accents, %-escapes).
    linkedin_pattern = (
        r'(?i:(?:https?://)?(?:(?:www|[a-z]{2})\.)?linkedin\.com/(?:in|pub)/)'
        r'[^\s/?#|,;()\[\]<>"\'“”]+'
    )

    # The text's matches first, in document order, then those inside each link
    # target in link order (T-0017). Never via set(), whose order varies per process.
    sources = [text, *links]

    # First match in document order.
    emails = re.findall(email_pattern, text)

    # Phone numbers might have duplicates due to formatting, keep distinct digits
    phones_raw = re.findall(phone_pattern, text)
    phones = [re.sub(r'[^0-9+]', '', p) for p in phones_raw if len(re.sub(r'[^0-9]', '', p)) >= 10]

    # A bare profile link beats a repository link; otherwise the owner of the first repo link.
    github_profile = github_repo_owner = None
    for m in (m for source in sources for m in re.finditer(github_pattern, source)):
        owner = m.group(2).rstrip('.')
        if not owner:
            continue
        link = m.group(1) + owner
        if (m.group(3) or '').strip('/').rstrip('.'):
            github_repo_owner = github_repo_owner or link
        else:
            github_profile = link
            break
    github_link = github_profile or github_repo_owner

    linkedin_links = [
        m.group().rstrip('.,')
        for source in sources for m in re.finditer(linkedin_pattern, source)
    ]

    return {
        "candidate_name": candidate_name,
        "email": emails[0] if emails else None,
        "phone": phones[0] if phones else None,
        "github": github_link,
        "linkedin": linkedin_links[0] if linkedin_links else None,
        # Every web link: the text's own, then link targets not already listed.
        "links": _collect_links(text, links),
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
