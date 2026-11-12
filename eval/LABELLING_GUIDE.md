# Labelling guide for the parsing evaluation set (TM-1)

Owner: Anthony. Labellers: Aaron and Anurag. Disagreements settled by: Aditya. Due: 14 Nov 2026.

## What this is for

We will report one measured number for Patina's resume parser: how well it finds the skills in a resume. To measure that, we need resumes where people have written down the correct answer by hand. Your labels are that correct answer. If the labels are careless, the number is meaningless, so accuracy matters more than speed.

Do not look at what Patina's parser outputs before or while you label. The labels must come from the resume alone.

## 1. Which resumes may be used

Only two kinds of resume are allowed:

1. **Public:** a file from the Kaggle "Resume Dataset" named in our SRS (the one with PDF resumes sorted into job-category folders).
2. **Consented:** a resume whose owner has agreed in writing (a chat message or email is enough) that it may be used to test the parser. Your own resume counts if you agree. Keep the message; send it to Anthony with the set.

No other source. No resume found by searching the web, and none from a company or a recruiter.

Privacy rules:
- Resume files and label files are sent to Anthony directly. They are never committed to the repository and never posted in a group chat.
- You may use an AI assistant for a first pass on a **public** resume. Never paste a **consented** resume into an AI tool unless its owner agreed to that as well.
- Every label you submit must be one you checked yourself against the resume. An AI's unchecked answer is not a label.

## 2. Building the set of 30

- 30 resumes in total, all for IT or software roles.
- At least 8 must be support or operations roles (help desk, IT support, system or network administration, application support, DevOps or operations).
- Each file must be a PDF or DOCX with selectable text. If you cannot select text in it with the mouse, it is a scanned image: skip it.
- **Do not choose resumes by how they look.** In the dataset's Information Technology folder, sort the files by name and take them in order. Skip a file only if it is scanned, is not in English, or is not an IT role, and write down each skipped file and the reason. Continue until you have the number you need. For the support and operations resumes, go through the same sorted list and take the first ones whose role fits; if that folder runs out, use the next most relevant folder the same way and note which one.
- Aaron builds the list. Both labellers then label the same 30 files.

## 3. What to label

For each resume, record three things.

### 3.1 Skills

List every skill the resume **names**. A skill here means a specific, named piece of technology or a named IT standard:

| Label it | Examples |
|---|---|
| Programming and scripting languages | Python, Java, C, C++, C#, Go, R, JavaScript, Bash, PowerShell, SQL |
| Frameworks and libraries | React, Django, Spring Boot, Express.js, TensorFlow, .NET |
| Databases | MySQL, PostgreSQL, MongoDB, Oracle Database, Redis |
| Cloud platforms and their services | AWS, Azure, Google Cloud, EC2, S3 |
| Operating systems | Linux, Ubuntu, Windows Server, macOS |
| Tools and products | Git, Docker, Kubernetes, Jenkins, Jira, ServiceNow, Nagios, Active Directory, VMware, Excel |
| Protocols and named IT standards | TCP/IP, DNS, HTTP, REST, ITIL |

Do **not** label these:

| Do not label | Examples |
|---|---|
| Soft skills | communication, teamwork, leadership, problem solving |
| General fields and concepts | machine learning, web development, networking, object-oriented programming, data structures, cloud computing, troubleshooting |
| Working methods | Agile, Scrum, Waterfall, SDLC |
| Certificates and degrees | "AWS Certified Solutions Architect", "CCNA", "B.Tech". But a product named inside ordinary text still counts: "deployed services on AWS" → `aws` |
| Job titles, company names, college names | "Java Developer" as a title alone does not count; "developed in Java" does |

Rules:
1. **Only what is written.** If the resume says Django and never says Python, label `django` only. Do not add what you think the person must know.
2. **Anywhere in the resume counts:** the skills list, job descriptions, projects, the summary.
3. **Once each.** If Python appears five times, write it once.
4. **Lower case, common full name, no version numbers.** "Python 3.9" → `python`. "JS" → `javascript`. "Postgres" → `postgresql`. "MS Excel" → `excel`. "K8s" → `kubernetes`. If you are unsure of the full name, write it as the resume does, in lower case.
5. **Keep distinct things distinct.** `java` and `javascript` are different. `c`, `c++` and `c#` are different. `react` and `react native` are different. `sql` (the language) and `mysql` (a product) are different; label whichever the resume names, or both if it names both.
6. **A word that is also ordinary English counts only when it clearly means the technology.** "Used Express for the API" → `express.js`. "Able to express ideas clearly" → nothing. "Oracle database administrator" → `oracle database`. "Spring internship" → nothing.
7. **If you cannot decide** whether something belongs, label it and add a short note in the notes column. Aditya decides.

### 3.2 Contact fields

Copy each of these exactly as written in the resume, or leave the cell empty if it is not there:
- email address
- GitHub profile URL (for example `github.com/username`)
- LinkedIn profile URL

Many public-dataset resumes have none of these. That is fine; leave them empty.

### 3.3 Role type

One of: `development`, `support_operations`, `other`.

## 4. The file you hand in

One spreadsheet per labeller, saved as CSV, named `aaron.csv` or `anurag.csv`. One row per resume, with exactly these columns:

| Column | Content |
|---|---|
| `resume_file` | The file name, exactly, for example `10089434.pdf` |
| `source` | `kaggle` or `consented` |
| `role_type` | `development`, `support_operations` or `other` |
| `skills` | All skills for that resume in one cell, separated by semicolons: `python; django; postgresql; git` |
| `email` | As written, or empty |
| `github_url` | As written, or empty |
| `linkedin_url` | As written, or empty |
| `notes` | Anything you were unsure about; otherwise empty |

Example row:

```
10089434.pdf,kaggle,support_operations,windows server; active directory; servicenow; powershell; tcp/ip,,,"unsure whether 'O365' should be office 365"
```

## 5. How the two labellers work

1. Label all 30 resumes **independently**. Do not compare or discuss until both files are finished.
2. Send both CSV files to Aditya.
3. Aditya compares them row by row. Wherever the two differ (a skill only one of you listed, a different contact value, a different role type), Aditya opens the resume, applies the rules in section 3, and decides. Aditya does not take a majority or a guess; the resume decides.
4. Aditya writes the agreed result as `gold.csv` in the same format, using the `notes` column to record each decision that was not obvious.
5. Aditya sends Anthony: `aaron.csv`, `anurag.csv`, `gold.csv`, the 30 resume files, the list of skipped files with reasons, and the consent messages for any consented resume.

We keep the two original files because we also report how often the two of you agreed. Do not edit your file after seeing the other one.

## 6. How the labels are used

So that you know nothing is hidden:

- The parser's output for each resume is compared with `gold.csv`. A skill in both is a correct find; a skill only in the parser's output is a false find; a skill only in `gold.csv` is a miss. From these we report precision, recall and F1.
- Different spellings of the same skill are matched through one alias table, fixed before measuring (for example `postgres` and `postgresql`).
- The parser sometimes outputs things this guide tells you not to label, such as "machine learning". Those terms are on a fixed out-of-scope list and are removed from the parser's output before comparing, so they count neither for nor against it. The list covers only the "do not label" categories in section 3.1.
- Contact fields are compared exactly.
- The result is reported whatever it is, with the size of the set.

## 7. Questions

Ask Anthony before guessing about a rule. If a rule in this guide turns out to be unclear, it is changed for everyone at once and both labellers recheck the affected resumes.
