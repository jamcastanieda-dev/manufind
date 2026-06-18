from __future__ import annotations

from pathlib import Path


def extract_pdf_pages(file_path: Path) -> list[dict[str, object]]:
    """Return extracted text per PDF page.

    pypdf is imported lazily so the API can still start even if the dependency
    has not been installed yet. Install requirements.txt before using uploads.
    """
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise RuntimeError("pypdf is not installed. Run: pip install -r requirements.txt") from exc

    reader = PdfReader(str(file_path))
    pages: list[dict[str, object]] = []

    for index, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        pages.append({"page_number": index, "text": text.strip()})

    return pages


def make_snippet(text: str, query: str, radius: int = 120) -> str:
    if not text:
        return ""
    lowered = text.lower()
    needle = query.lower().strip()
    if not needle:
        return text[: radius * 2]

    pos = lowered.find(needle)
    if pos == -1:
        return text[: radius * 2].strip()

    start = max(0, pos - radius)
    end = min(len(text), pos + len(query) + radius)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return f"{prefix}{text[start:end].strip()}{suffix}"
