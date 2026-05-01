import pdfplumber
from docx import Document
import os

def extract_from_pdf(file_path: str) -> str:
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text.strip()

def extract_from_docx(file_path: str) -> str:
    doc = Document(file_path)
    text = ""
    for paragraph in doc.paragraphs:
        if paragraph.text.strip():
            text += paragraph.text + "\n"
    return text.strip()

def extract_text(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        return extract_from_pdf(file_path)
    elif ext == ".docx":
        return extract_from_docx(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

# ── TEST BLOCK ──────────────────────────────────────────
if __name__ == "__main__":
    test_file = "sample_resume.pdf"
    result = extract_text(test_file)
    print("──── EXTRACTED TEXT ────")
    print(result)
    print("──── TOTAL CHARACTERS:", len(result))