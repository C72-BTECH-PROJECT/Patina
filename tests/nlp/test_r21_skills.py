"""R-21: skill precision and support vocabulary (offline; no service needed).

One group of cases per rule of the card (DECISIONS 4.2, ISSUES I-0004):
- "github" is not a skill (profile URLs, the label "GitHub", "not on GitHub");
  links and email addresses never yield a skill;
- English words (express, spring, oracle, apache, rust) and a bare "API" need a
  technical context;
- "Node.js" is not JavaScript and "Java Script" is not Java;
- C, Go and R are detected, in context only;
- ServiceNow, Jira, ITIL, Nagios, Active Directory, Windows Server and close
  relatives are in the vocabulary; fixture f3 and the support demo resume yield them;
- invented catalog entries are gone.

Imports nlp-engine in-process; run with the nlp-engine venv interpreter.
"""

import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
FIXTURES = REPO / "tests" / "fixtures"
sys.path.insert(0, str(REPO / "nlp-engine"))

from app.extractor import extract_document  # noqa: E402
from app.ner import (  # noqa: E402
    CONTEXT_SKILLS, SKILL_KEYWORDS, extract_entities, extract_skills, normalize_skill,
)


def skills(text):
    return extract_skills(text)


def fixture_skills(name):
    doc = extract_document(str(FIXTURES / name))
    return extract_entities(doc.text, links=doc.links)["skills"]


# --- "github" is not a skill; links and emails yield no skill --------------------------

@pytest.mark.parametrize("text", [
    "Jane Doe\ngithub.com/example-jdoe\nSKILLS\nPython",
    "Jane Doe\nGitHub | LinkedIn | Portfolio\nSKILLS\nPython",
    "Most work is internal and not on GitHub.\nSKILLS\nPython",
    "Code reviews on GitHub, CI on GitHub Actions.\nPython",
], ids=["profile-url", "link-label", "not-on-github", "prose"])
def test_github_is_not_a_skill(text):
    assert skills(text) == ["python"]


def test_links_and_emails_yield_no_skill():
    text = ("Jane Doe\nhttps://gitlab.com/example-jdoe/react-tools | python.dev@example.com"
            " | https://jdoe.example.com/docker\nSKILLS\nSQL")
    assert skills(text) == ["sql"]


@pytest.mark.parametrize("fixture", [
    "f1_dev_github.pdf", "f2_dev_github.docx", "f4_support_nogithub.docx", "f5_multicolumn.pdf",
    "f7_realworld_links.pdf", "f8_realworld_links.docx",
])
def test_fixtures_have_no_github_skill(fixture):
    found = fixture_skills(fixture)
    assert found and "github" not in found


# --- English words need a technical context ---------------------------------------------

@pytest.mark.parametrize("text", [
    "Able to express ideas clearly to customers.",
    "Joined after a spring internship at a bakery.",
    "Seen as the oracle of team knowledge.",
    "Apache County outreach volunteer.",
    "Cleaned rust off the old pipes.",
    "Streamed events with Apache Kafka.",
], ids=["express", "spring", "oracle", "apache", "rust", "apache-kafka-is-kafka"])
def test_english_words_alone_are_not_skills(text):
    assert not {"express", "spring", "oracle", "apache", "rust"} & set(skills(text))


@pytest.mark.parametrize("text,skill", [
    ("Built Express APIs backed by MongoDB.", "express"),
    ("Used Express.js for the API layer.", "express"),
    ("Built the backend with Express and MongoDB.", "express"),
    ("Node/Express services.", "express"),
    ("Java, Express, MongoDB", "express"),
    ("Moved views to Spring MVC.", "spring"),
    ("Skills: Java, Spring, Hibernate", "spring"),
    ("Tuned Oracle 19c and Oracle Database queries.", "oracle"),
    ("SQL, Oracle, PL/SQL", "oracle"),
    ("Configured Apache HTTP Server virtual hosts.", "apache"),
    ("Nginx, Apache, Tomcat", "apache"),
    ("Rewrote the parser in Rust for speed.", "rust"),
    ("Languages: Python, Rust", "rust"),
], ids=["express-apis", "express-js", "with-express", "node-express", "express-list",
        "spring-mvc", "spring-list", "oracle-19c", "oracle-list", "apache-http-server",
        "apache-list", "rust-built-in", "rust-list"])
def test_english_words_in_technical_context_are_skills(text, skill):
    assert skill in skills(text)


def test_spring_boot_is_its_own_skill():
    assert skills("Java, Spring Boot, Docker") == ["java", "spring boot", "docker"]
    assert "spring" not in skills("Split a monolith into Spring Boot microservices.")


def test_word_in_skills_section_counts_alone():
    assert "rust" in skills("Jane Doe\nSKILLS\nRust\nEXPERIENCE\nDeveloper - Example Corp")


@pytest.mark.parametrize("text", [
    "Worked with the API team on onboarding.",
    "Read the API docs.",
    "APIs",
], ids=["api-team", "api-docs", "bare"])
def test_bare_api_is_not_a_skill(text):
    assert "api" not in skills(text)


@pytest.mark.parametrize("text", [
    "Designed REST APIs for billing.",
    "Built Express APIs for a dashboard.",
    "Ran the API gateway.",
    "Developed internal APIs.",
], ids=["rest-apis", "framework-apis", "api-gateway", "built-apis"])
def test_api_in_technical_context(text):
    assert "api" in skills(text)


# --- Node.js and "Java Script" ------------------------------------------------------------

@pytest.mark.parametrize("text,expected", [
    ("Backend in Node.js.", ["nodejs"]),
    ("Node JS developer", ["nodejs"]),
    ("React.js front end", ["react"]),
    ("Frontend in Java Script.", ["javascript"]),
    ("Java and JavaScript", ["java", "javascript"]),
    ("JS, HTML", ["javascript", "html"]),
], ids=["node.js", "node-js-spaced", "react.js", "java-script", "java-and-javascript", "bare-js"])
def test_node_js_and_java_script(text, expected):
    assert skills(text) == expected


def test_f2_node_js_is_not_javascript():
    found = fixture_skills("f2_dev_github.docx")
    assert "nodejs" in found and "javascript" not in found


# --- C, Go and R ---------------------------------------------------------------------------

@pytest.mark.parametrize("text,expected", [
    ("Languages: C, C++, Go, R, Python", {"c", "c++", "go", "r", "python"}),
    ("Proficient in C/C++.", {"c", "c++"}),
    ("Wrote firmware in C for sensors.", {"c"}),
    ("Embedded C on ARM boards.", {"c"}),
    ("Services written in Go and Python.", {"go", "python"}),
    ("Golang microservices", {"go"}),
    ("Statistical modelling in R and Python.", {"r", "python"}),
    ("R programming and RStudio", {"r"}),
], ids=["list", "c-slash-cpp", "c-written-in", "embedded-c", "go-written-in", "golang",
        "r-in", "r-programming"])
def test_c_go_r_detected(text, expected):
    assert expected <= set(skills(text))


@pytest.mark.parametrize("text", [
    "Let us go to the meeting. Go live in March.",
    "Grade C in mathematics; Section C.",
    "Led the R&D department.",
    "C# and .NET developer",
    "Objective-C, Swift",
    "Built in-house tools for the C-suite.",
], ids=["go-english", "grade-c", "r-and-d", "c-sharp", "objective-c", "c-suite"])
def test_c_go_r_not_invented(text):
    assert not {"c", "go", "r"} & set(skills(text))


# --- support vocabulary --------------------------------------------------------------------

def test_f3_yields_support_tools():
    found = fixture_skills("f3_support_nogithub.pdf")
    assert {"servicenow", "jira", "itil", "nagios"} <= set(found)
    assert {"active directory", "windows server"} <= set(found)


def test_demo_support_ops_yields_support_tools():
    found = set(fixture_skills("demo/demo_support_ops.pdf"))
    assert {"servicenow", "jira", "itil", "nagios", "active directory", "windows server",
            "group policy", "powershell"} <= found


@pytest.mark.parametrize("text,skill", [
    ("Tickets in Service Now.", "servicenow"),
    ("Jira Service Management queues", "jira"),
    ("ITIL v3 and ITIL4 processes", "itil"),
    ("Patched 40 Windows servers.", "windows server"),
    ("Monitoring with Zabbix and Grafana.", "zabbix"),
    ("Splunk dashboards", "splunk"),
    ("AWS CloudWatch alarms", "cloudwatch"),
    ("Scripts in PowerShell.", "powershell"),
    ("Managed Group Policy objects.", "group policy"),
    ("O365 and Exchange Server migration", "office 365"),
    ("Hyper-V and VMware hosts", "hyper-v"),
    ("Device rollout with Intune and SCCM.", "sccm"),
], ids=["servicenow", "jira-sm", "itil", "windows-servers", "zabbix", "splunk", "cloudwatch",
        "powershell", "group-policy", "o365", "hyper-v", "sccm"])
def test_support_vocabulary(text, skill):
    assert skill in skills(text)


# --- catalog and normalisation (I-0004) ----------------------------------------------------

def test_invented_entries_removed():
    for entry in ("exponentjs", "github", "r language", "golang"):
        assert entry not in SKILL_KEYWORDS
    # Every context skill sits in the catalog, so its place in the output order is fixed.
    assert set(CONTEXT_SKILLS) <= set(SKILL_KEYWORDS)


@pytest.mark.parametrize("raw,canonical", [
    ("Golang", "go"), ("go lang", "go"), ("R language", "r"), ("Express.js", "express"),
    ("Spring-Boot", "spring boot"), ("Oracle Database", "oracle"), ("Service Now", "servicenow"),
    ("O365", "office 365"), ("Windows Servers", "windows server"), ("Node.js", "nodejs"),
    ("Jira Service Management", "jira"), ("AWS CloudWatch", "cloudwatch"),
])
def test_normalize_skill_maps_new_spellings(raw, canonical):
    assert normalize_skill(raw) == canonical
