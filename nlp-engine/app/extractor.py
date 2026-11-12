"""Text extraction for uploaded resumes.

`extract_text` either returns non-empty text or raises one of the two errors
below. It never returns an empty string, so an unreadable resume can never
flow on into entity extraction and scoring as if it were a real (empty) one.
"""

import os

import pdfplumber
from docx import Document

SUPPORTED_EXTENSIONS = (".pdf", ".docx", ".txt")

# Reasons reported in the 422 `unreadable_document` response.
REASON_EMPTY = "empty"                  # zero bytes, or a document with no pages / no content at all
REASON_NO_TEXT_LAYER = "no_text_layer"  # pages (or images) exist but carry no extractable text, e.g. a scan
REASON_CORRUPT = "corrupt"              # the file cannot be opened as the type its extension claims


class UnsupportedFileType(Exception):
    """The extension is not one the parser can read (e.g. .doc, .png, none)."""

    def __init__(self, extension: str):
        super().__init__(f"Unsupported file type: {extension or '(none)'}")
        self.extension = extension


class UnreadableDocument(Exception):
    """The file is of a supported type but yields no text."""

    def __init__(self, reason: str, detail: str = ""):
        super().__init__(detail or reason)
        self.reason = reason


def file_extension(filename: str | None) -> str:
    return os.path.splitext(filename or "")[1].lower()


def extract_from_pdf(file_path: str) -> str:
    try:
        with pdfplumber.open(file_path) as pdf:
            page_count = len(pdf.pages)
            parts = []
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    parts.append(page_text + "\n")
    except Exception as exc:  # pdfminer raises many unrelated types for a bad file
        raise UnreadableDocument(REASON_CORRUPT, f"PDF could not be opened: {type(exc).__name__}") from exc

    text = "".join(parts).strip()
    if text:
        return text
    if page_count == 0:
        raise UnreadableDocument(REASON_EMPTY, "PDF has no pages")
    raise UnreadableDocument(REASON_NO_TEXT_LAYER, f"PDF has {page_count} page(s) but no text layer")


def extract_from_docx(file_path: str) -> str:
    try:
        doc = Document(file_path)
    except Exception as exc:  # PackageNotFoundError, BadZipFile, KeyError, lxml errors, ...
        raise UnreadableDocument(REASON_CORRUPT, f"DOCX could not be opened: {type(exc).__name__}") from exc

    # Paragraphs only, as before: tables, headers and text boxes are not read.
    text = ""
    for paragraph in doc.paragraphs:
        if paragraph.text.strip():
            text += paragraph.text + "\n"
    text = text.strip()
    if text:
        return text
    if len(doc.inline_shapes) > 0:
        raise UnreadableDocument(REASON_NO_TEXT_LAYER, "DOCX contains images but no paragraph text")
    raise UnreadableDocument(REASON_EMPTY, "DOCX has no paragraph text")


def extract_from_txt(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        text = f.read().strip()
    if not text:
        raise UnreadableDocument(REASON_EMPTY, "text file is blank")
    return text


_EXTRACTORS = {
    ".pdf": extract_from_pdf,
    ".docx": extract_from_docx,
    ".txt": extract_from_txt,
}


def extract_text(file_path: str) -> str:
    """Return the document's text (never empty) or raise.

    Raises UnsupportedFileType for an extension outside SUPPORTED_EXTENSIONS and
    UnreadableDocument(reason) when a supported file yields no text.
    """
    ext = file_extension(file_path)
    extractor = _EXTRACTORS.get(ext)
    if extractor is None:
        raise UnsupportedFileType(ext)
    if os.path.getsize(file_path) == 0:
        raise UnreadableDocument(REASON_EMPTY, "file is zero bytes")
    return extractor(file_path)
