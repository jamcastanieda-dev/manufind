from __future__ import annotations

import os
from pathlib import Path
from typing import Any


OCR_RENDER_SCALE = 3
EMBEDDED_TEXT_MIN_CHARS = 80


def _configure_tesseract() -> None:
    """Use Tesseract path from the TESSERACT_CMD environment variable."""
    tesseract_cmd = os.getenv("TESSERACT_CMD")
    if not tesseract_cmd:
        return

    import pytesseract

    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd


def _preprocess_image(image: Any) -> Any:
    """Improve OCR accuracy for small/scanned text before Tesseract runs."""
    from PIL import ImageFilter, ImageOps

    grayscale = ImageOps.grayscale(image)
    contrasted = ImageOps.autocontrast(grayscale)
    sharpened = contrasted.filter(ImageFilter.SHARPEN)
    return sharpened.point(lambda value: 0 if value < 170 else 255, mode="1")


def _ocr_page(page: Any) -> str:
    """Render one PDF page as an image and run Tesseract OCR."""
    try:
        import fitz
        import pytesseract
        from pytesseract import TesseractNotFoundError
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError(
            "OCR dependencies are missing. Run: pip install PyMuPDF pytesseract Pillow"
        ) from exc

    _configure_tesseract()

    matrix = fitz.Matrix(OCR_RENDER_SCALE, OCR_RENDER_SCALE)
    pixmap = page.get_pixmap(matrix=matrix, alpha=False)
    image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
    processed_image = _preprocess_image(image)

    try:
        return pytesseract.image_to_string(
            processed_image,
            config="--oem 3 --psm 6",
        ).strip()
    except TesseractNotFoundError as exc:
        configured_path = os.getenv("TESSERACT_CMD")
        if configured_path:
            raise RuntimeError(
                f"Tesseract was not found at TESSERACT_CMD={configured_path!r}. "
                "Install Tesseract OCR or update the TESSERACT_CMD environment variable."
            ) from exc
        raise RuntimeError(
            "Tesseract OCR is not installed or is not on PATH. "
            "Install Tesseract or set the TESSERACT_CMD environment variable."
        ) from exc


def _should_run_ocr(text: str) -> bool:
    return len(text.strip()) < EMBEDDED_TEXT_MIN_CHARS


def _merge_text_sources(embedded_text: str, ocr_text: str) -> str:
    embedded_text = embedded_text.strip()
    ocr_text = ocr_text.strip()

    if not embedded_text:
        return ocr_text
    if not ocr_text:
        return embedded_text
    if len(ocr_text) > len(embedded_text):
        return ocr_text
    return embedded_text


def extract_pdf_pages(file_path: Path) -> list[dict[str, object]]:
    """Return searchable text for each PDF page.

    First tries normal embedded PDF text.
    If a page has no embedded text, it renders the page as an image and runs OCR.
    """
    try:
        import fitz
    except ImportError as exc:
        raise RuntimeError("PyMuPDF is not installed. Run: pip install PyMuPDF") from exc

    pages: list[dict[str, object]] = []

    document = fitz.open(str(file_path))
    try:
        for page_number, page in enumerate(document, start=1):
            embedded_text = (page.get_text("text") or "").strip()
            text = embedded_text

            if _should_run_ocr(embedded_text):
                ocr_text = _ocr_page(page)
                text = _merge_text_sources(embedded_text, ocr_text)

            pages.append(
                {
                    "page_number": page_number,
                    "text": text.strip(),
                }
            )
    finally:
        document.close()

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
