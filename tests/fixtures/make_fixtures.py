"""Generate the synthetic resume fixtures used by the T-0001 harness.

Every person, employer, school, email, phone number and link below is
fictional (example.com / example-* handles). Do not put real resumes here;
those go in tests/private/ (git-ignored).

f7-f10 (R-30) have the structure of a real-world resume that parsed badly
(phone beside the name, a full LinkedIn URL, links behind words, an education
block over several lines) and of DOCX layouts whose text is not in plain body
paragraphs (a table with header and footer, text boxes). demo/ holds the two
synthetic resumes of the TM-4 demo set (see demo/README.md).

Run with the NLP venv (needs python-docx, fpdf2, Pillow):
    nlp-engine/venv/Scripts/python tests/fixtures/make_fixtures.py

Output is byte-stable across runs (fixed PDF/DOCX timestamps) so regenerating
does not show up as a diff.
"""

import datetime as dt
import io
import zipfile
from pathlib import Path

from docx import Document
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn
from fpdf import FPDF
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
FIXED_TS = dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)


# --------------------------------------------------------------------------
# Resume content. Each resume is a list of (heading, lines) sections plus a
# contact header, so the same data can be written to PDF, DOCX or an image.
# --------------------------------------------------------------------------

F1 = {
    "name": "Maya Okafor",
    "contact": [
        "maya.okafor@example.com | +1 555 010 4477 | Austin, TX",
        "github.com/example-mokafor | linkedin.com/in/example-maya-okafor",
    ],
    "sections": [
        ("Summary", [
            "Backend-leaning software engineer with 3 years of experience building",
            "Python web services and React front ends.",
        ]),
        ("Skills", [
            "Python, Django, FastAPI, React, JavaScript, PostgreSQL, SQL, Docker,",
            "AWS, Git, REST API, Redis, Pytest",
        ]),
        ("Experience", [
            "Software Engineer - Northwind Labs (Jun 2022 - Present)",
            "- Built REST APIs in Django and FastAPI serving 40k daily users.",
            "- Cut p95 latency by 35% by adding Redis caching and query indexes.",
            "- Containerised services with Docker and deployed to AWS ECS.",
            "Software Engineering Intern - Bluebird Analytics (Jan 2022 - May 2022)",
            "- Wrote ETL jobs in Python and SQL for the reporting warehouse.",
        ]),
        ("Projects", [
            "Ledgerly - personal finance tracker (React, FastAPI, PostgreSQL)",
            "github.com/example-mokafor/ledgerly",
            "QueueBench - load-testing harness for job queues (Python, Redis)",
        ]),
        ("Education", [
            "B.Tech in Computer Science - Example Institute of Technology (2018 - 2022)",
        ]),
    ],
}

F2 = {
    "name": "Arjun Mehta",
    "contact": [
        "arjun.mehta@example.com | +91 98765 01234 | Pune, India",
        "github.com/example-arjunm",
    ],
    "sections": [
        ("Summary", [
            "Java and Node.js developer with 4 years in product companies.",
        ]),
        ("Technical Skills", [
            "Java, Spring Boot, Node.js, Express, MongoDB, MySQL, Kubernetes,",
            "Docker, Git, Jenkins, Microservices",
        ]),
        ("Work Experience", [
            "Senior Developer - Contoso Retail Tech (Aug 2021 - Present)",
            "- Split a monolith into six Spring Boot microservices on Kubernetes.",
            "- Owned the order service: 99.95% availability over 12 months.",
            "Developer - Fabrikam Software (Jul 2019 - Jul 2021)",
            "- Built Express APIs backed by MongoDB for a logistics dashboard.",
        ]),
        ("Projects", [
            "RateLimiter - token-bucket middleware for Express",
            "github.com/example-arjunm/ratelimiter",
        ]),
        ("Education", [
            "B.E. in Information Technology - Example University of Pune (2015 - 2019)",
        ]),
    ],
}

F3 = {
    "name": "Lena Fischer",
    "contact": [
        "lena.fischer@example.com | +49 151 5550 1234 | Hamburg, Germany",
    ],
    "sections": [
        ("Summary", [
            "IT support engineer focused on incident management and keeping",
            "production systems healthy. No public code portfolio.",
        ]),
        ("Skills", [
            "Linux, Windows Server, SQL, Bash, ServiceNow, Jira, ITIL,",
            "Nagios, Active Directory, Incident Management, Troubleshooting",
        ]),
        ("Experience", [
            "Application Support Engineer - Tailspin Logistics (Mar 2021 - Present)",
            "- Resolved 600+ L2 tickets with a 96% SLA hit rate.",
            "- Wrote Bash and SQL runbooks that cut mean time to resolve by 30%.",
            "- Ran monthly patching for 120 Linux and Windows servers.",
            "IT Helpdesk Analyst - Woodgrove Bank (Jan 2019 - Feb 2021)",
            "- First-line support for 800 staff; managed Active Directory accounts.",
        ]),
        ("Certifications", [
            "ITIL 4 Foundation (2021)",
        ]),
        ("Education", [
            "B.Sc. in Information Systems - Example University Hamburg (2015 - 2018)",
        ]),
    ],
}

F4 = {
    "name": "Samuel Adeyemi",
    "contact": [
        "samuel.adeyemi@example.com | +44 7700 900123 | Leeds, UK",
    ],
    "sections": [
        ("Profile", [
            "Production support and maintenance engineer. Keeps legacy",
            "billing systems running; most work is internal and not on GitHub.",
        ]),
        ("Core Skills", [
            "SQL, Oracle, PL/SQL, Shell Scripting, Python, Splunk,",
            "AWS CloudWatch, Jenkins, Root Cause Analysis, On-call",
        ]),
        ("Employment", [
            "Production Support Engineer - Litware Billing (May 2020 - Present)",
            "- Primary on-call for a 15-year-old Oracle billing platform.",
            "- Automated nightly health checks in Python and Splunk alerts.",
            "- Led 20+ root-cause analyses; reduced repeat incidents by 40%.",
            "Maintenance Engineer - Adventure Works IT (Jun 2017 - Apr 2020)",
            "- Patched and maintained PL/SQL batch jobs and shell scripts.",
        ]),
        ("Education", [
            "HND in Computing - Example College Leeds (2015 - 2017)",
        ]),
    ],
}

F5 = {
    "name": "Rosa Delgado",
    "sidebar": [
        ("Contact", [
            "rosa.delgado@example.com",
            "+1 555 010 9988",
            "Denver, CO",
            "github.com/example-rdelgado",
        ]),
        ("Skills", [
            "Python", "FastAPI", "PostgreSQL", "SQL", "Docker", "Kubernetes",
            "AWS", "Terraform", "Git",
        ]),
        ("Education", [
            "B.S. Computer Science",
            "Example State University",
            "2016 - 2020",
        ]),
    ],
    "main": [
        ("Experience", [
            "Platform Engineer",
            "Proseware Cloud (Feb 2022 - Present)",
            "- Ran 40 Kubernetes services on AWS EKS with Terraform.",
            "- Built FastAPI internal tools for deploy approvals.",
            "Backend Developer",
            "Lucerne Media (Jul 2020 - Jan 2022)",
            "- Wrote Python services over PostgreSQL for ad reporting.",
        ]),
        ("Projects", [
            "infra-lint - Terraform policy checker",
            "github.com/example-rdelgado/infra-lint",
        ]),
    ],
}

F6 = {
    "name": "Tomas Novak",
    "contact": [
        "tomas.novak@example.com | +420 555 010 222 | Brno, Czechia",
        "github.com/example-tnovak",
    ],
    "sections": [
        ("Skills", [
            "Python, Django, PostgreSQL, Docker, Git, REST API",
        ]),
        ("Experience", [
            "Python Developer - Margie's Travel (Sep 2021 - Present)",
            "- Maintained Django booking APIs and PostgreSQL schemas.",
        ]),
        ("Education", [
            "M.Sc. Informatics - Example Technical University Brno (2019 - 2021)",
        ]),
    ],
}

# R-30: the structure of a real-world resume that parsed badly, with invented
# content. The phone number sits beside the name (with a country code; no
# Indian mobile number starts with 5, so it is plainly fake), the LinkedIn URL
# is written out in full, GitHub and the portfolio are links behind words, and
# the education block runs over several lines with a CGPA and honours.
F7 = {
    "name": "PRIYA LINKWELL",
    "phone": "+91 55555 01234",
    "email": "priya.linkwell@example.com",
    "linkedin_text": "https://www.linkedin.com/in/example-priya-linkwell/",
    "github_target": "https://github.com/example-plinkwell",
    "portfolio_target": "https://plinkwell.example.com/portfolio",
    "sections": [
        ("Summary", [
            "Computer engineering graduate building data tools in Python, SQL and PostgreSQL.",
        ]),
        ("Skills", [
            "Python, SQL, PostgreSQL, Pandas, Docker, Git",
        ]),
        ("Experience", [
            "Data Engineering Intern - Example Analytics Pvt Ltd (Jan 2025 - Jun 2025)",
            "- Built Python and SQL jobs that load sensor data into PostgreSQL.",
        ]),
        ("Education", [
            "Example Institute of Technology, Pune",
            "Bachelor of Technology in Computer Engineering",
            "2021 - 2025 | CGPA: 8.72/10",
            "Honours in Artificial Intelligence",
            "Higher Secondary Certificate (HSC)",
            "Example Junior College, Mumbai",
            "2021 | Percentage: 88.5%",
        ]),
    ],
}

# R-30 / R-05: everything is in a two-column table, a header and a footer;
# there is no plain body paragraph at all.
F9 = {
    "name": "TOBIAS WREN",
    "contact": "tobias.wren@example.com | +1 (202) 555-0123",
    "footer": "linkedin.com/in/example-tobias-wren",
    "left": [
        ("Skills", ["Linux, Bash, SQL, Python, Docker, Jenkins, Git, AWS"]),
        ("Education", [
            "B.Sc. in Computer Science",
            "Example University of Leeds",
            "2016 - 2019",
        ]),
    ],
    "right": [
        ("Experience", [
            "Site Reliability Engineer - Proseware Cloud (Mar 2020 - Present)",
            "- Ran Jenkins pipelines that build Docker images and deploy them to AWS.",
            "- Wrote Bash and Python tooling for Linux fleet patching.",
        ]),
    ],
}

# R-30 / R-05: the whole resume is inside one text box (Word writes it twice:
# the modern shape and a legacy VML copy as fallback).
F10 = {
    "lines": [
        "INES CALLOWAY",
        "ines.calloway@example.com | +1 (202) 555-0145",
        "SKILLS",
        "Python, Django, PostgreSQL, Redis, Docker",
        "EXPERIENCE",
        "Backend Developer - Lucerne Media (Jun 2021 - Present)",
        "- Built Django services over PostgreSQL with Redis caching.",
    ],
}

# TM-4 demo set (R-30). Both people are invented. Contact details use
# example.com and the 555-01xx range reserved for fiction; employers are
# Microsoft's fictional sample companies; there is no link to any account.
# Demo job: tests/fixtures/jds/dev.txt with the "dev" skills in manifest.json.
DEMO_KEYWORD_STUFFED = {
    "name": "Casey Brightwater",
    "contact": [
        "casey.brightwater@example.com | +1 (202) 555-0187",
    ],
    "sections": [
        ("Summary", [
            "Results-driven professional skilled in Python, SQL, PostgreSQL, Docker, Git,",
            "REST API, React, Redis, AWS and Kubernetes.",
        ]),
        ("Skills", [
            "Python, SQL, PostgreSQL, Docker, Git, REST API, React, Redis, AWS, Kubernetes",
            "Python | SQL | PostgreSQL | Docker | Git | REST API | React | Redis | AWS | Kubernetes",
            "Keywords: Python developer, SQL expert, PostgreSQL expert, Docker expert,",
            "Git expert, REST API expert, React expert, Redis expert, AWS expert, Kubernetes expert",
        ]),
        ("Experience", [
            "Software Professional - Tailspin Toys (2023 - Present)",
            "- Worked with Python, SQL, PostgreSQL, Docker, Git, REST API, React, Redis, AWS, Kubernetes.",
        ]),
        ("Education", [
            "B.Sc. - Example College (2019 - 2022)",
        ]),
    ],
}

DEMO_SUPPORT_OPS = {
    "name": "Teodor Halloway",
    "contact": [
        "teodor.halloway@example.com | +1 (202) 555-0164 | Springfield",
    ],
    "sections": [
        ("Summary", [
            "IT operations engineer with seven years of service desk and L2 support.",
            "I keep Windows and Linux estates patched, monitored and documented, and I",
            "run incidents to closure. Most of my work is internal, so there is no public code.",
        ]),
        ("Skills", [
            "ServiceNow, Jira Service Management, ITIL 4, Nagios, Active Directory,",
            "Windows Server, Group Policy, PowerShell, Linux, SQL, PostgreSQL, Python scripting",
        ]),
        ("Experience", [
            "IT Operations Engineer - Wide World Importers (Apr 2021 - Present)",
            "- Own the L2 incident queue in ServiceNow for 1,400 staff on six sites; 95% of P2 tickets closed inside SLA.",
            "- Run ITIL change and problem management for monthly Windows Server patching of 210 servers.",
            "- Added Nagios checks for disk space, services and certificate expiry; disk-full incidents fell by 90%.",
            "- Wrote PowerShell and Python scripts that automate Active Directory joiner and leaver tasks.",
            "- Investigate data problems in the warehouse application's PostgreSQL database with read-only SQL.",
            "Service Desk Analyst - Alpine Ski House (Jul 2018 - Mar 2021)",
            "- First-line support for 300 staff; tracked requests and problems in Jira Service Management.",
            "- Managed Active Directory accounts, Group Policy and Windows Server file shares.",
            "- Kept the team's runbooks in Git alongside the infrastructure scripts.",
        ]),
        ("Certifications", [
            "ITIL 4 Foundation (2020)",
        ]),
        ("Education", [
            "B.Sc. in Information Technology - Example University (2014 - 2017)",
        ]),
    ],
}


# --------------------------------------------------------------------------
# Writers
# --------------------------------------------------------------------------

def _new_pdf():
    pdf = FPDF(format="A4")
    pdf.set_creation_date(FIXED_TS)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    return pdf


def write_single_column_pdf(data, path):
    pdf = _new_pdf()
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 10, data["name"], new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    for line in data["contact"]:
        pdf.cell(0, 5, line, new_x="LMARGIN", new_y="NEXT")
    for heading, lines in data["sections"]:
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 7, heading.upper(), new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        for line in lines:
            pdf.multi_cell(0, 5, line, new_x="LMARGIN", new_y="NEXT")
    pdf.output(str(path))


def write_two_column_pdf(data, path):
    """Left sidebar (contact/skills/education) beside a main column."""
    pdf = _new_pdf()
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 10, data["name"], new_x="LMARGIN", new_y="NEXT")
    top = pdf.get_y() + 2
    left_x, left_w = 10, 55
    right_x, right_w = 72, 128

    def column(x, w, sections):
        pdf.set_xy(x, top)
        for heading, lines in sections:
            pdf.set_x(x)
            pdf.set_font("Helvetica", "B", 11)
            pdf.cell(w, 7, heading.upper(), new_x="LEFT", new_y="NEXT")
            pdf.set_font("Helvetica", "", 10)
            for line in lines:
                pdf.set_x(x)
                pdf.multi_cell(w, 5, line, new_x="LEFT", new_y="NEXT")
            pdf.ln(3)

    column(left_x, left_w, data["sidebar"])
    column(right_x, right_w, data["main"])
    pdf.output(str(path))


def _load_font(size):
    for name in ("arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


def write_image_only_pdf(data, path):
    """Render the resume as a bitmap and embed only that image (no text layer),
    the way a scanned resume arrives. Exercises the missing-OCR path."""
    width, height = 1240, 1754  # A4 at 150 dpi
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)
    title, body, head = _load_font(44), _load_font(24), _load_font(28)
    y = 80
    draw.text((80, y), data["name"], fill="black", font=title)
    y += 70
    for line in data["contact"]:
        draw.text((80, y), line, fill="black", font=body)
        y += 34
    for heading, lines in data["sections"]:
        y += 24
        draw.text((80, y), heading.upper(), fill="black", font=head)
        y += 42
        for line in lines:
            draw.text((80, y), line, fill="black", font=body)
            y += 34
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    buf.seek(0)
    pdf = FPDF(format="A4")
    pdf.set_creation_date(FIXED_TS)
    pdf.add_page()
    pdf.image(buf, x=0, y=0, w=210, h=297)
    pdf.output(str(path))


def _new_docx():
    doc = Document()
    props = doc.core_properties
    props.author = "T-0001 fixture generator"
    props.created = FIXED_TS.replace(tzinfo=None)
    props.modified = FIXED_TS.replace(tzinfo=None)
    props.last_modified_by = "T-0001 fixture generator"
    props.revision = 1
    return doc


def _add_section_lines(doc_or_cell, lines):
    for line in lines:
        if line.startswith("- "):
            doc_or_cell.add_paragraph(line[2:], style="List Bullet")
        else:
            doc_or_cell.add_paragraph(line)


def write_docx(data, path):
    doc = _new_docx()
    doc.add_heading(data["name"], level=0)
    for line in data["contact"]:
        doc.add_paragraph(line)
    for heading, lines in data["sections"]:
        doc.add_heading(heading, level=1)
        _add_section_lines(doc, lines)
    _save_docx(doc, path)


def _save_docx(doc, path):
    buf = io.BytesIO()
    doc.save(buf)
    # python-docx stamps each zip entry with the current time; rewrite the
    # archive with a fixed timestamp so the file is byte-stable.
    buf.seek(0)
    with zipfile.ZipFile(buf) as src, zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as dst:
        for item in src.infolist():
            info = zipfile.ZipInfo(item.filename, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            dst.writestr(info, src.read(item.filename))


# --------------------------------------------------------------------------
# R-30 writers
# --------------------------------------------------------------------------

def write_realworld_pdf(data, path):
    """Name and phone on one line; a contact line whose GitHub and Portfolio
    labels are link annotations with no URL text, beside a written-out LinkedIn
    URL and a mailto: link on the email."""
    pdf = _new_pdf()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(pdf.get_string_width(data["name"]) + 4, 9, data["name"])
    pdf.set_font("Helvetica", "", 16)
    pdf.cell(0, 9, data["phone"], new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    for text, link in (
        (data["email"], "mailto:" + data["email"]),
        (" | ", ""),
        (data["linkedin_text"], data["linkedin_text"]),
        (" | ", ""),
        ("GitHub", data["github_target"]),
        (" | ", ""),
        ("Portfolio", data["portfolio_target"]),
    ):
        pdf.cell(pdf.get_string_width(text) + 1, 5, text, link=link)
    pdf.ln(5)
    for heading, lines in data["sections"]:
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 7, heading.upper(), new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        for line in lines:
            pdf.multi_cell(0, 5, line, new_x="LMARGIN", new_y="NEXT")
    pdf.output(str(path))


def _add_hyperlink(paragraph, url, text):
    """A w:hyperlink whose target is an external relationship (what Word writes
    for a link inserted on a word)."""
    r_id = paragraph.part.relate_to(url, RT.HYPERLINK, is_external=True)
    link = OxmlElement("w:hyperlink")
    link.set(qn("r:id"), r_id)
    run = OxmlElement("w:r")
    t = OxmlElement("w:t")
    t.text = text
    run.append(t)
    link.append(run)
    paragraph._p.append(link)


def _add_field_hyperlink(paragraph, url, text):
    """A simple HYPERLINK field: its shown text is not part of python-docx's
    Paragraph.text, which is one way a written-out URL goes missing."""
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), f'HYPERLINK "{url}"')
    run = OxmlElement("w:r")
    t = OxmlElement("w:t")
    t.text = text
    run.append(t)
    field.append(run)
    paragraph._p.append(field)


def write_realworld_docx(data, path):
    doc = _new_docx()
    doc.add_heading(f"{data['name']}\t{data['phone']}", level=0)
    p = doc.add_paragraph(data["email"] + " | ")
    _add_field_hyperlink(p, data["linkedin_text"], data["linkedin_text"])
    p.add_run(" | ")
    _add_hyperlink(p, data["github_target"], "GitHub")
    p.add_run(" | ")
    _add_hyperlink(p, data["portfolio_target"], "Portfolio")
    for heading, lines in data["sections"]:
        doc.add_heading(heading, level=1)
        _add_section_lines(doc, lines)
    _save_docx(doc, path)


def write_table_layout_docx(data, path):
    """Name and contact in the page header, the LinkedIn URL in the footer,
    and every section inside one two-column table: no body paragraph."""
    doc = _new_docx()
    section = doc.sections[0]
    section.header.paragraphs[0].text = data["name"]
    section.header.add_paragraph(data["contact"])
    section.footer.paragraphs[0].text = data["footer"]
    table = doc.add_table(rows=1, cols=2)
    for cell, sections in zip(table.rows[0].cells, (data["left"], data["right"])):
        for i, (heading, lines) in enumerate(sections):
            if i == 0:
                cell.paragraphs[0].text = heading.upper()
            else:
                cell.add_paragraph(heading.upper())
            _add_section_lines(cell, lines)
    _save_docx(doc, path)


_TEXTBOX_RUN = """<w:r xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
 xmlns:v="urn:schemas-microsoft-com:vml"><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing>
<wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="251659264"
 behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/>
<wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH>
<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>
<wp:extent cx="5486400" cy="3200400"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>
<wp:docPr id="1" name="Text Box 1"/><wp:cNvGraphicFramePr/>
<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">
<wps:wsp><wps:cNvSpPr txBox="1"/><wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5486400" cy="3200400"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></wps:spPr>
<wps:txbx><w:txbxContent>{paragraphs}</w:txbxContent></wps:txbx><wps:bodyPr/></wps:wsp>
</a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice>
<mc:Fallback><w:pict><v:shape id="Text Box 1" type="#_x0000_t202" style="position:absolute;width:432pt;height:252pt">
<v:textbox><w:txbxContent>{paragraphs}</w:txbxContent></v:textbox></v:shape></w:pict></mc:Fallback>
</mc:AlternateContent></w:r>"""


def write_textbox_only_docx(data, path):
    from xml.sax.saxutils import escape

    paragraphs = "".join(
        f'<w:p><w:r><w:t xml:space="preserve">{escape(line)}</w:t></w:r></w:p>'
        for line in data["lines"]
    )
    doc = _new_docx()
    doc.add_paragraph()._p.append(parse_xml(_TEXTBOX_RUN.format(paragraphs=paragraphs)))
    _save_docx(doc, path)


def main():
    write_single_column_pdf(F1, HERE / "f1_dev_github.pdf")
    write_docx(F2, HERE / "f2_dev_github.docx")
    write_single_column_pdf(F3, HERE / "f3_support_nogithub.pdf")
    write_docx(F4, HERE / "f4_support_nogithub.docx")
    write_two_column_pdf(F5, HERE / "f5_multicolumn.pdf")
    write_image_only_pdf(F6, HERE / "f6_image_only.pdf")
    write_realworld_pdf(F7, HERE / "f7_realworld_links.pdf")
    write_realworld_docx(F7, HERE / "f8_realworld_links.docx")
    write_table_layout_docx(F9, HERE / "f9_table_layout.docx")
    write_textbox_only_docx(F10, HERE / "f10_textbox_only.docx")
    demo = HERE / "demo"
    demo.mkdir(exist_ok=True)
    write_single_column_pdf(DEMO_KEYWORD_STUFFED, demo / "demo_keyword_stuffed.pdf")
    write_single_column_pdf(DEMO_SUPPORT_OPS, demo / "demo_support_ops.pdf")
    print("wrote 10 fixtures and 2 demo resumes to", HERE)


if __name__ == "__main__":
    main()
