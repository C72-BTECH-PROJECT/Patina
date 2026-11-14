"""R-30: parsing a real-world resume (offline; no service needed).

One case per rule of the card, on the synthetic fixtures f7-f10 and the TM-4 demo
resumes (tests/fixtures/make_fixtures.py):
- the name never carries phone, country-code, email or URL tokens;
- every web link written in the text is listed, LinkedIn and GitHub also in their fields;
- link targets behind words (PDF annotations, DOCX hyperlinks) reach the contact
  fields only and never the text;
- education is one entry per qualification with its fields attached;
- DOCX text in tables, headers, footers and text boxes is read in document order.

Imports nlp-engine in-process; run with the nlp-engine venv interpreter.
"""

import sys
from pathlib import Path

import pytest
from docx import Document

REPO = Path(__file__).resolve().parents[2]
FIXTURES = REPO / "tests" / "fixtures"
sys.path.insert(0, str(REPO / "nlp-engine"))

from app.extractor import extract_document, extract_links, extract_text  # noqa: E402
from app.ner import extract_entities  # noqa: E402

PRIYA_GITHUB = "https://github.com/example-plinkwell"
PRIYA_LINKEDIN_TEXT = "https://www.linkedin.com/in/example-priya-linkwell/"
PRIYA_PORTFOLIO = "https://plinkwell.example.com/portfolio"


def parse(name):
    doc = extract_document(str(FIXTURES / name))
    return doc, extract_entities(doc.text, links=doc.links)


# --- name -----------------------------------------------------------------------

@pytest.mark.parametrize("text,expected", [
    ("PRIYA LINKWELL +91 55555 01234\npriya@example.com\nSKILLS\nPython", "PRIYA LINKWELL"),
    ("PRIYA LINKWELL\t+91 55555 01234\nSKILLS\nPython", "PRIYA LINKWELL"),
    ("Jane Q. Doe | jane.doe@example.com | +1 (202) 555-0100\nSKILLS\nSQL", "Jane Q. Doe"),
    ("Jane Doe https://jane.example.com\nSKILLS\nSQL", "Jane Doe"),
    ("Name: Ravi Example\nravi@example.com\nSKILLS\nSQL", "Ravi Example"),
    ("Resume\nMarta Example-Lund, +46 555 010 000\nSKILLS\nSQL", "Marta Example-Lund"),
], ids=["country-code-beside-name", "tab-then-phone", "pipe-contact", "url-beside-name",
        "name-label", "resume-title-first"])
def test_name_excludes_contact_tokens(text, expected):
    assert extract_entities(text)["candidate_name"] == expected


@pytest.mark.parametrize("fixture", ["f7_realworld_links.pdf", "f8_realworld_links.docx"])
def test_fixture_name_has_no_phone(fixture):
    _, ent = parse(fixture)
    assert ent["candidate_name"] == "PRIYA LINKWELL"


def test_spacy_fallback_name_is_cut_at_contact_token():
    # No usable header line, so the spaCy PERSON fallback runs; whatever it
    # returns must not carry digits, "+", "@" or a URL.
    text = "SUMMARY\nI worked with Maria Example +91 55555 01234 on billing.\n"
    name = extract_entities(text)["candidate_name"]
    assert name is None or not any(ch in name for ch in "+@/0123456789")


# --- links written in the text ------------------------------------------------------

def test_every_web_link_in_text_is_listed():
    text = (
        "Jane Doe\n"
        "jane@example.com | https://www.LinkedIn.com/in/example-jane-doe/ | github.com/example-jdoe\n"
        "Portfolio: janedoe.dev  Blog: https://blog.example.org/jane\n"
        "SKILLS\nB.Tech, B.Com, Node.js, ASP.NET, socket.io, Vue.js\n"
    )
    ent = extract_entities(text)
    assert ent["links"] == [
        "https://www.LinkedIn.com/in/example-jane-doe/",
        "github.com/example-jdoe",
        "janedoe.dev",
        "https://blog.example.org/jane",
    ]
    assert ent["linkedin"] == "https://www.LinkedIn.com/in/example-jane-doe"
    assert ent["github"] == "github.com/example-jdoe"


@pytest.mark.parametrize("text,expected", [
    ("https://www.linkedin.com/in/example-a/", "https://www.linkedin.com/in/example-a"),
    ("LinkedIn.com/in/Example-B", "LinkedIn.com/in/Example-B"),
    ("https://in.linkedin.com/in/example-c", "https://in.linkedin.com/in/example-c"),
    ("www.linkedin.com/in/example-d%C3%A9v.", "www.linkedin.com/in/example-d%C3%A9v"),
], ids=["full-with-slash", "mixed-case", "country-subdomain", "percent-escape"])
def test_linkedin_url_written_in_full(text, expected):
    assert extract_entities(f"Jane Doe\n{text}\n")["linkedin"] == expected


@pytest.mark.parametrize("fixture", ["f7_realworld_links.pdf", "f8_realworld_links.docx"])
def test_fixture_full_linkedin_url_is_found(fixture):
    _, ent = parse(fixture)
    assert ent["linkedin"] == "https://www.linkedin.com/in/example-priya-linkwell"


# --- link targets behind words (I-0052) ------------------------------------------------

def test_extract_links_pdf():
    # Document order; the mailto: link on the email is dropped.
    assert extract_links(str(FIXTURES / "f7_realworld_links.pdf")) == [
        PRIYA_LINKEDIN_TEXT, PRIYA_GITHUB, PRIYA_PORTFOLIO,
    ]
    assert extract_links(str(FIXTURES / "f1_dev_github.pdf")) == []


def test_extract_links_docx():
    assert extract_links(str(FIXTURES / "f8_realworld_links.docx")) == [
        PRIYA_LINKEDIN_TEXT, PRIYA_GITHUB, PRIYA_PORTFOLIO,
    ]
    assert extract_links(str(FIXTURES / "f2_dev_github.docx")) == []


@pytest.mark.parametrize("fixture", ["f7_realworld_links.pdf", "f8_realworld_links.docx"])
def test_link_targets_reach_contact_fields(fixture):
    doc, ent = parse(fixture)
    assert "github.com" not in doc.text.lower()          # only the label "GitHub" is visible
    assert "plinkwell.example.com" not in doc.text
    assert ent["github"] == PRIYA_GITHUB
    assert ent["links"] == [PRIYA_LINKEDIN_TEXT, PRIYA_GITHUB, PRIYA_PORTFOLIO]


@pytest.mark.parametrize("fixture", ["f7_realworld_links.pdf", "f8_realworld_links.docx"])
def test_link_targets_do_not_change_text_derived_fields(fixture):
    doc, with_links = parse(fixture)
    without = extract_entities(doc.text)
    for key in ("skills", "skill_count", "experience", "education", "projects", "candidate_name", "email"):
        assert with_links[key] == without[key], key
    assert without["github"] is None
    assert extract_text(str(FIXTURES / fixture)) == doc.text


@pytest.mark.parametrize("text,links,expected", [
    ("Jane Doe\ngithub.com/alice", ["https://github.com/bob"], "github.com/alice"),
    ("Jane Doe\ngithub.com/acme/tool", ["https://github.com/bob"], "https://github.com/bob"),
    ("Jane Doe\nno link", ["https://github.com/x/repo", "https://github.com/y"], "https://github.com/y"),
    ("Jane Doe\nno link", ["https://github.com/x/repo"], "https://github.com/x"),
    ("Jane Doe\nno link", [], None),
], ids=["text-profile-first", "profile-beats-repo", "link-profile-beats-link-repo",
        "repo-owner-from-link", "none"])
def test_link_precedence(text, links, expected):
    assert extract_entities(text, links=links)["github"] == expected


# --- education ----------------------------------------------------------------------

PRIYA_EDUCATION = [
    {
        "institution": "Example Institute of Technology, Pune",
        "degree": "Bachelor of Technology in Computer Engineering",
        "dates": "2021 – 2025",
        "graduation_year": 2025,
        "grade": "CGPA: 8.72/10",
        "honours": "Honours in Artificial Intelligence",
    },
    {
        "institution": "Example Junior College, Mumbai",
        "degree": "Higher Secondary Certificate (HSC)",
        "dates": "2021",
        "graduation_year": 2021,
        "grade": "Percentage: 88.5%",
        "honours": None,
    },
]


@pytest.mark.parametrize("fixture", ["f7_realworld_links.pdf", "f8_realworld_links.docx"])
def test_education_one_entry_per_qualification(fixture):
    _, ent = parse(fixture)
    got = [{k: v for k, v in e.items() if k != "text"} for e in ent["education"]]
    assert got == PRIYA_EDUCATION
    assert all(e["text"] for e in ent["education"])


def test_education_three_line_block_is_one_entry():
    _, ent = parse("f5_multicolumn.pdf")
    assert len(ent["education"]) == 1
    entry = ent["education"][0]
    assert (entry["degree"], entry["institution"], entry["graduation_year"]) == (
        "B.S. Computer Science", "Example State University", 2020)


@pytest.mark.parametrize("lines,expected", [
    (["B.Tech in Computer Science - Example University (2019 - 2023)", "B.Tech Honours in Data Science"],
     {"degree": "B.Tech in Computer Science", "honours": "B.Tech Honours in Data Science", "graduation_year": 2023}),
    (["Example University", "M.Sc. Data Science, 2024 - Present", "GPA 3.8/4.0"],
     {"degree": "M.Sc. Data Science", "graduation_year": None, "grade": "GPA 3.8/4.0"}),
    (["Bachelor of Engineering, Example College, 2020", "First Class with Distinction"],
     {"institution": "Example College", "honours": "First Class with Distinction", "graduation_year": 2020}),
], ids=["honours-line-with-degree-word", "ongoing-degree", "honours-only-line"])
def test_education_fields(lines, expected):
    text = "Jane Doe\nEDUCATION\n" + "\n".join(lines) + "\n"
    entries = extract_entities(text)["education"]
    assert len(entries) == 1, entries
    for key, value in expected.items():
        assert entries[0][key] == value, key


# --- DOCX tables, headers, footers, text boxes (R-05 triage) ---------------------------

def test_table_layout_docx_parses_to_its_skills():
    path = FIXTURES / "f9_table_layout.docx"
    # Before R-30 only body paragraphs were read, and this file has none with text.
    assert not any(p.text.strip() for p in Document(str(path)).paragraphs)
    doc, ent = parse("f9_table_layout.docx")
    assert sorted(ent["skills"]) == sorted(
        ["linux", "bash", "sql", "python", "docker", "jenkins", "git", "aws"])
    assert ent["candidate_name"] == "TOBIAS WREN"                       # page header
    assert ent["linkedin"] == "linkedin.com/in/example-tobias-wren"      # page footer
    assert ent["experience"][0]["title"] == "Site Reliability Engineer"
    # The footer is read after the table; its link-only line is not a job.
    assert not any("linkedin" in str(e).lower() for e in ent["experience"])
    assert ent["education"][0]["institution"] == "Example University of Leeds"


def test_docx_reads_header_then_table_then_footer():
    lines = extract_text(str(FIXTURES / "f9_table_layout.docx")).split("\n")
    order = [lines.index(s) for s in (
        "TOBIAS WREN", "SKILLS", "EDUCATION", "EXPERIENCE", "linkedin.com/in/example-tobias-wren")]
    assert order == sorted(order)


def test_textbox_only_docx_is_readable_once():
    text = extract_text(str(FIXTURES / "f10_textbox_only.docx"))
    # The legacy fallback copy of the box is not read a second time.
    assert text.count("INES CALLOWAY") == 1
    _, ent = parse("f10_textbox_only.docx")
    assert ent["candidate_name"] == "INES CALLOWAY"
    assert sorted(ent["skills"]) == ["django", "docker", "postgresql", "python", "redis"]


@pytest.mark.parametrize("fixture", ["f2_dev_github.docx", "f4_support_nogithub.docx"])
def test_plain_docx_text_unchanged(fixture):
    old = "".join(p.text + "\n" for p in Document(str(FIXTURES / fixture)).paragraphs if p.text.strip()).strip()
    assert extract_text(str(FIXTURES / fixture)) == old


# --- TM-4 demo set --------------------------------------------------------------------

DEV_JOB_SKILLS = {"python", "sql", "postgresql", "docker", "git", "react", "redis", "aws", "kubernetes"}


def test_demo_keyword_stuffed():
    doc, ent = parse("demo/demo_keyword_stuffed.pdf")
    assert ent["candidate_name"] == "Casey Brightwater"
    assert ent["github"] is None and ent["linkedin"] is None and ent["links"] == [] and doc.links == []
    assert ent["email"].endswith("@example.com")
    assert DEV_JOB_SKILLS <= set(ent["skills"])
    assert {"rest", "api"} <= set(ent["skills"])


def test_demo_support_ops():
    doc, ent = parse("demo/demo_support_ops.pdf")
    assert ent["candidate_name"] == "Teodor Halloway"
    assert ent["github"] is None and ent["linkedin"] is None and ent["links"] == [] and doc.links == []
    assert ent["email"].endswith("@example.com")
    for word in ("ServiceNow", "Jira", "ITIL", "Nagios", "Active Directory", "Windows Server"):
        assert word in doc.text
    assert [e["title"] for e in ent["experience"]] == ["IT Operations Engineer", "Service Desk Analyst"]
    assert {"python", "postgresql", "git", "linux", "sql"} <= set(ent["skills"])
