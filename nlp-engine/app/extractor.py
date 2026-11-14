"""Text and link-target extraction for uploaded resumes.

`extract_text` either returns non-empty text or raises one of the two errors
below. It never returns an empty string, so an unreadable resume can never
flow on into entity extraction and scoring as if it were a real (empty) one.

`extract_document` returns the same text plus the link targets attached to
words in the file (PDF URI annotations, DOCX hyperlink relationships and
HYPERLINK fields). The targets are never added to the text: they go to the
contact parser only, so skills, the text preview and similarity are not
changed by them (R-30, I-0052, T-0017).
"""

import logging
import os
import re
from typing import NamedTuple

import pdfplumber
from docx import Document
from docx.opc.constants import RELATIONSHIP_TYPE as RT

logger = logging.getLogger("nlp-engine")

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


class ExtractedDocument(NamedTuple):
    text: str          # never empty
    links: list        # web link targets attached to words, document order, no duplicates


def file_extension(filename: str | None) -> str:
    return os.path.splitext(filename or "")[1].lower()


def _web_links(targets) -> list:
    """Keep http(s) and www. targets, in order, first occurrence only.

    mailto:, tel:, file: and in-document anchors are dropped: they are not
    profile links.
    """
    out, seen = [], set()
    for raw in targets:
        if not isinstance(raw, str):
            continue
        url = raw.strip()
        if not re.match(r"(?i)^(?:https?://|www\.)\S+$", url):
            continue
        key = url.lower().rstrip("/")
        if key not in seen:
            seen.add(key)
            out.append(url)
    return out


# --- PDF ----------------------------------------------------------------------

def _read_pdf(file_path: str) -> ExtractedDocument:
    links = []
    try:
        with pdfplumber.open(file_path) as pdf:
            page_count = len(pdf.pages)
            parts = []
            for page_no, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    parts.append(page_text + "\n")
                try:
                    for annot in page.hyperlinks:
                        links.append((page_no, annot.get("top") or 0, annot.get("x0") or 0, annot.get("uri")))
                except Exception as exc:  # a broken annotation must not cost the text
                    logger.warning("pdf link annotations unreadable on page %d: %s", page_no, type(exc).__name__)
    except Exception as exc:  # pdfminer raises many unrelated types for a bad file
        raise UnreadableDocument(REASON_CORRUPT, f"PDF could not be opened: {type(exc).__name__}") from exc

    text = "".join(parts).strip()
    if text:
        links.sort(key=lambda item: item[:3])
        return ExtractedDocument(text, _web_links(uri for *_pos, uri in links))
    if page_count == 0:
        raise UnreadableDocument(REASON_EMPTY, "PDF has no pages")
    raise UnreadableDocument(REASON_NO_TEXT_LAYER, f"PDF has {page_count} page(s) but no text layer")


# --- DOCX ---------------------------------------------------------------------
# The body is walked as XML, in document order: paragraphs, table cells (nested
# tables too), content controls and text boxes. Headers are read before the
# body and footers after it. python-docx's `doc.paragraphs` sees none of the
# tables, headers or text boxes, and its `Paragraph.text` drops the text of
# simple fields (`w:fldSimple`, e.g. a HYPERLINK field), tracked insertions and
# smart tags; the walker below reads those too and skips deleted text.

_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_MC = "http://schemas.openxmlformats.org/markup-compatibility/2006"


def _w(tag: str) -> str:
    return f"{{{_W}}}{tag}"


_P, _T, _TAB, _PTAB = _w("p"), _w("t"), _w("tab"), _w("ptab")
_BR, _CR, _NBH = _w("br"), _w("cr"), _w("noBreakHyphen")
_TXBX = _w("txbxContent")
_FALLBACK = f"{{{_MC}}}Fallback"
# Subtrees whose text is not part of the visible paragraph: deleted text, the
# text-box content (read separately, as its own block), the duplicate legacy
# copy of a drawing, field instructions, and pPr/rPr property blocks.
_SKIP_IN_PARAGRAPH = {_w("del"), _w("delText"), _w("instrText"), _TXBX, _FALLBACK, _w("pPr"), _w("rPr")}
# Block containers that hold paragraphs; recursed into in order.
_BLOCK_CONTAINERS = {_w("tbl"), _w("tr"), _w("tc"), _w("sdt"), _w("sdtContent"), _w("customXml"), _w("ins")}
_HYPERLINK_INSTR_RE = re.compile(r'HYPERLINK\s+"([^"]+)"', re.I)


def _inline_text(element, out: list) -> None:
    for child in element:
        tag = child.tag
        if not isinstance(tag, str) or tag in _SKIP_IN_PARAGRAPH:
            continue
        if tag == _T:
            out.append(child.text or "")
        elif tag in (_TAB, _PTAB):
            out.append("\t")
        elif tag == _BR:
            # A page or column break is not a line of text (as python-docx reads it).
            out.append("\n" if child.get(_w("type"), "textWrapping") == "textWrapping" else "")
        elif tag == _CR:
            out.append("\n")
        elif tag == _NBH:
            out.append("-")
        else:
            _inline_text(child, out)


def _own_text_boxes(paragraph):
    """Text boxes anchored in this paragraph, excluding the legacy fallback copy
    of each one and boxes nested inside another box (those are read with it)."""
    for box in paragraph.iter(_TXBX):
        nested = False
        for ancestor in box.iterancestors():
            if ancestor is paragraph:
                break
            if ancestor.tag in (_FALLBACK, _TXBX):
                nested = True
                break
        if not nested:
            yield box


def _block_lines(container, out: list) -> None:
    for child in container:
        tag = child.tag
        if tag == _P:
            parts = []
            _inline_text(child, parts)
            text = "".join(parts)
            if text.strip():
                out.append(text)
            for box in _own_text_boxes(child):
                _block_lines(box, out)
        elif tag in _BLOCK_CONTAINERS:
            _block_lines(child, out)


def _header_footer_parts(doc):
    """(headers, footers) parts in section order, each part once."""
    headers, footers, seen = [], [], set()
    for sect_pr in doc.element.body.iter(_w("sectPr")):
        for ref_tag, bucket in ((_w("headerReference"), headers), (_w("footerReference"), footers)):
            refs = sorted(
                sect_pr.iterchildren(ref_tag),
                key=lambda r: {"first": 0, "default": 1, "even": 2}.get(r.get(_w("type")), 3),
            )
            for ref in refs:
                rid = ref.get(f"{{{_R}}}id")
                part = doc.part.related_parts.get(rid) if rid else None
                if part is not None and id(part) not in seen:
                    seen.add(id(part))
                    bucket.append(part)
    return headers, footers


def _part_links(part) -> list:
    """Link targets in one part (body, header or footer), in document order."""
    targets = []
    for el in part.element.iter(_w("hyperlink"), _w("fldSimple"), _w("instrText")):
        if el.tag == _w("hyperlink"):
            rid = el.get(f"{{{_R}}}id")
            rel = part.rels.get(rid) if rid else None
            if rel is not None and rel.is_external and rel.reltype == RT.HYPERLINK:
                targets.append(rel.target_ref)
        else:
            instr = el.get(_w("instr")) if el.tag == _w("fldSimple") else el.text
            for match in _HYPERLINK_INSTR_RE.finditer(instr or ""):
                targets.append(match.group(1))
    return targets


def _has_drawings(parts) -> bool:
    return any(
        next(part.element.iter(_w("drawing"), _w("pict")), None) is not None
        for part in parts
    )


def _read_docx(file_path: str) -> ExtractedDocument:
    try:
        doc = Document(file_path)
    except Exception as exc:  # PackageNotFoundError, BadZipFile, KeyError, lxml errors, ...
        raise UnreadableDocument(REASON_CORRUPT, f"DOCX could not be opened: {type(exc).__name__}") from exc

    headers, footers = _header_footer_parts(doc)
    lines = []
    for part in headers:
        _block_lines(part.element, lines)
    _block_lines(doc.element.body, lines)
    for part in footers:
        _block_lines(part.element, lines)

    text = "\n".join(lines).strip()
    if text:
        targets = []
        try:
            for part in [*headers, doc.part, *footers]:
                targets.extend(_part_links(part))
        except Exception as exc:  # a broken relationship must not cost the text
            logger.warning("docx link targets unreadable: %s", type(exc).__name__)
        return ExtractedDocument(text, _web_links(targets))
    if len(doc.inline_shapes) > 0 or _has_drawings([*headers, doc.part, *footers]):
        raise UnreadableDocument(REASON_NO_TEXT_LAYER, "DOCX contains images but no text")
    raise UnreadableDocument(REASON_EMPTY, "DOCX has no text")


# --- TXT ----------------------------------------------------------------------

def _read_txt(file_path: str) -> ExtractedDocument:
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        text = f.read().strip()
    if not text:
        raise UnreadableDocument(REASON_EMPTY, "text file is blank")
    # A plain-text file has no link targets apart from the URLs in its text.
    return ExtractedDocument(text, [])


_READERS = {
    ".pdf": _read_pdf,
    ".docx": _read_docx,
    ".txt": _read_txt,
}


def extract_document(file_path: str) -> ExtractedDocument:
    """Return the document's text (never empty) and its link targets, or raise.

    Raises UnsupportedFileType for an extension outside SUPPORTED_EXTENSIONS and
    UnreadableDocument(reason) when a supported file yields no text.
    """
    ext = file_extension(file_path)
    reader = _READERS.get(ext)
    if reader is None:
        raise UnsupportedFileType(ext)
    if os.path.getsize(file_path) == 0:
        raise UnreadableDocument(REASON_EMPTY, "file is zero bytes")
    return reader(file_path)


def extract_text(file_path: str) -> str:
    """The document's text only (never empty) or raise; see extract_document."""
    return extract_document(file_path).text


def extract_links(file_path: str) -> list:
    """The document's link targets only; see extract_document."""
    return extract_document(file_path).links


# Kept for callers that used the per-type functions directly.
def extract_from_pdf(file_path: str) -> str:
    return _read_pdf(file_path).text


def extract_from_docx(file_path: str) -> str:
    return _read_docx(file_path).text


def extract_from_txt(file_path: str) -> str:
    return _read_txt(file_path).text
