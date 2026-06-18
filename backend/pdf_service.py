from __future__ import annotations

import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any


OCR_RENDER_SCALE = 3
EMBEDDED_TEXT_MIN_CHARS = 80
OCR_HIGHLIGHT_MIN_CONFIDENCE = 8
OCR_PRIMARY_CONFIGS = ("--oem 3 --psm 6", "--oem 3 --psm 11")
OCR_ROTATION_SEQUENCE = (0, 90, 270, 180)


def _configure_tesseract() -> None:
    """Use Tesseract path from the TESSERACT_CMD environment variable."""
    tesseract_cmd = os.getenv("TESSERACT_CMD")
    if not tesseract_cmd:
        return

    import pytesseract

    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd


def _enhance_image(image: Any) -> Any:
    """Improve OCR accuracy for small/scanned text before Tesseract runs."""
    from PIL import ImageFilter, ImageOps

    grayscale = ImageOps.grayscale(image)
    contrasted = ImageOps.autocontrast(grayscale)
    return contrasted.filter(ImageFilter.SHARPEN)


def _preprocess_image(image: Any) -> Any:
    enhanced = _enhance_image(image)
    return enhanced.point(lambda value: 0 if value < 170 else 255, mode="1")


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


def _page_to_processed_image(page: Any) -> tuple[Any, int, int]:
    import fitz
    from PIL import Image

    matrix = fitz.Matrix(OCR_RENDER_SCALE, OCR_RENDER_SCALE)
    pixmap = page.get_pixmap(matrix=matrix, alpha=False)
    image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
    processed_image = _preprocess_image(image)
    return processed_image, pixmap.width, pixmap.height


def _page_to_ocr_images(page: Any) -> tuple[Any, Any, int, int]:
    import fitz
    from PIL import Image

    matrix = fitz.Matrix(OCR_RENDER_SCALE, OCR_RENDER_SCALE)
    pixmap = page.get_pixmap(matrix=matrix, alpha=False)
    image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
    enhanced_image = _enhance_image(image)
    threshold_image = enhanced_image.point(lambda value: 0 if value < 170 else 255, mode="1")
    return enhanced_image, threshold_image, pixmap.width, pixmap.height


def _transform_box_from_rotation(
    left: int,
    top: int,
    width: int,
    height: int,
    original_width: int,
    original_height: int,
    rotation: int,
) -> tuple[int, int, int, int]:
    if rotation == 0:
        return left, top, width, height

    corners = [
        (left, top),
        (left + width, top),
        (left, top + height),
        (left + width, top + height),
    ]

    restored: list[tuple[float, float]] = []
    for x_rotated, y_rotated in corners:
        if rotation == 90:
            x_original = original_width - y_rotated
            y_original = x_rotated
        elif rotation == 180:
            x_original = original_width - x_rotated
            y_original = original_height - y_rotated
        elif rotation == 270:
            x_original = y_rotated
            y_original = original_height - x_rotated
        else:
            x_original = x_rotated
            y_original = y_rotated
        restored.append((x_original, y_original))

    min_x = int(min(point[0] for point in restored))
    min_y = int(min(point[1] for point in restored))
    max_x = int(max(point[0] for point in restored))
    max_y = int(max(point[1] for point in restored))
    return min_x, min_y, max_x - min_x, max_y - min_y


def _rect_to_ratio_box(
    left: float,
    top: float,
    width: float,
    height: float,
    page_width: float,
    page_height: float,
    text: str,
) -> dict[str, object]:
    return {
        "text": text,
        "leftRatio": max(0.0, (left - 2) / page_width),
        "topRatio": max(0.0, (top - 2) / page_height),
        "widthRatio": min(1.0, (width + 4) / page_width),
        "heightRatio": min(1.0, (height + 4) / page_height),
    }


def _extract_embedded_highlight_boxes(page: Any, query: str) -> list[dict[str, object]]:
    page_rect = page.rect
    page_width = float(page_rect.width)
    page_height = float(page_rect.height)
    if page_width <= 0 or page_height <= 0:
        return []

    boxes: list[dict[str, object]] = []
    seen_boxes: set[tuple[int, int, int, int]] = set()
    for rect in page.search_for(query):
        width = float(rect.width)
        height = float(rect.height)
        if width <= 0 or height <= 0:
            continue

        left = float(rect.x0)
        top = float(rect.y0)
        dedupe_key = (
            round(left / page_width * 1000),
            round(top / page_height * 1000),
            round(width / page_width * 1000),
            round(height / page_height * 1000),
        )
        if dedupe_key in seen_boxes:
            continue
        seen_boxes.add(dedupe_key)
        boxes.append(_rect_to_ratio_box(left, top, width, height, page_width, page_height, query))

    return boxes


def _normalized_token(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _collect_pass_boxes(
    data: dict[str, list[Any]],
    normalized_query_tokens: list[str],
    image_width: int,
    image_height: int,
    seen_boxes: set[tuple[int, int, int, int]],
    rotation: int,
) -> list[dict[str, object]]:
    boxes: list[dict[str, object]] = []

    total_items = len(data["text"])
    if len(normalized_query_tokens) == 1:
        token = normalized_query_tokens[0]
        for index in range(total_items):
            raw_text = str(data["text"][index] or "").strip()
            confidence = str(data["conf"][index] or "").strip()
            normalized_word = _normalized_token(raw_text)
            if not raw_text or normalized_word != token:
                continue

            parsed_confidence = 0.0
            try:
                if confidence:
                    parsed_confidence = float(confidence)
            except ValueError:
                parsed_confidence = 0.0

            if parsed_confidence < OCR_HIGHLIGHT_MIN_CONFIDENCE:
                continue

            left = int(data["left"][index])
            top = int(data["top"][index])
            width = int(data["width"][index])
            height = int(data["height"][index])
            if width <= 0 or height <= 0:
                continue

            left, top, width, height = _transform_box_from_rotation(
                left,
                top,
                width,
                height,
                image_width,
                image_height,
                rotation,
            )

            dedupe_key = (
                round(left / image_width * 1000),
                round(top / image_height * 1000),
                round(width / image_width * 1000),
                round(height / image_height * 1000),
            )
            if dedupe_key in seen_boxes:
                continue
            seen_boxes.add(dedupe_key)

            boxes.append(
                {
                    "text": raw_text,
                    "leftRatio": max(0.0, (left - 4) / image_width),
                    "topRatio": max(0.0, (top - 2) / image_height),
                    "widthRatio": min(1.0, (width + 8) / image_width),
                    "heightRatio": min(1.0, (height + 4) / image_height),
                }
            )
        return boxes

    rows: dict[tuple[int, int, int], list[dict[str, Any]]] = {}
    for index in range(total_items):
        raw_text = str(data["text"][index] or "").strip()
        confidence = str(data["conf"][index] or "").strip()
        normalized_word = _normalized_token(raw_text)
        if not raw_text or not normalized_word:
            continue

        try:
            parsed_confidence = float(confidence) if confidence else 0.0
        except ValueError:
            parsed_confidence = 0.0
        if parsed_confidence < OCR_HIGHLIGHT_MIN_CONFIDENCE:
            continue

        width = int(data["width"][index])
        height = int(data["height"][index])
        if width <= 0 or height <= 0:
            continue

        row_key = (
            int(data["block_num"][index]),
            int(data["par_num"][index]),
            int(data["line_num"][index]),
        )
        rows.setdefault(row_key, []).append(
            {
                "index": index,
                "text": raw_text,
                "normalized": normalized_word,
                "left": int(data["left"][index]),
                "top": int(data["top"][index]),
                "width": width,
                "height": height,
            }
        )

    for row_words in rows.values():
        row_words.sort(key=lambda item: item["index"])
        normalized_words = [item["normalized"] for item in row_words]
        token_count = len(normalized_query_tokens)
        for start in range(0, max(0, len(row_words) - token_count + 1)):
            if normalized_words[start : start + token_count] != normalized_query_tokens:
                continue

            matched = row_words[start : start + token_count]
            left = min(item["left"] for item in matched)
            top = min(item["top"] for item in matched)
            right = max(item["left"] + item["width"] for item in matched)
            bottom = max(item["top"] + item["height"] for item in matched)
            width = right - left
            height = bottom - top
            left, top, width, height = _transform_box_from_rotation(
                left,
                top,
                width,
                height,
                image_width,
                image_height,
                rotation,
            )

            dedupe_key = (
                round(left / image_width * 1000),
                round(top / image_height * 1000),
                round(width / image_width * 1000),
                round(height / image_height * 1000),
            )
            if dedupe_key in seen_boxes:
                continue
            seen_boxes.add(dedupe_key)

            boxes.append(
                {
                    "text": " ".join(item["text"] for item in matched),
                    "leftRatio": max(0.0, (left - 4) / image_width),
                    "topRatio": max(0.0, (top - 2) / image_height),
                    "widthRatio": min(1.0, (width + 8) / image_width),
                    "heightRatio": min(1.0, (height + 4) / image_height),
                }
            )

    return boxes


def _run_tesseract_data(image: Any, config: str) -> dict[str, list[Any]]:
    import pytesseract

    return pytesseract.image_to_data(
        image,
        config=config,
        output_type=pytesseract.Output.DICT,
    )


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


@lru_cache(maxsize=512)
def _extract_page_highlight_boxes_cached(
    file_path_str: str,
    page_number: int,
    normalized_query: str,
) -> dict[str, object]:
    try:
        import fitz
        import pytesseract
        from pytesseract import TesseractNotFoundError
    except ImportError as exc:
        raise RuntimeError(
            "OCR highlight dependencies are missing. Run: pip install PyMuPDF pytesseract Pillow"
        ) from exc

    normalized_query_tokens = [_normalized_token(token) for token in normalized_query.split()]
    normalized_query_tokens = [token for token in normalized_query_tokens if token]

    if not normalized_query_tokens:
        return {"page": page_number, "boxes": []}

    _configure_tesseract()

    document = fitz.open(file_path_str)
    try:
        if page_number < 1 or page_number > document.page_count:
            raise ValueError(f"Page {page_number} is out of range for this PDF")

        page = document.load_page(page_number - 1)
        embedded_boxes = _extract_embedded_highlight_boxes(page, normalized_query)
        if embedded_boxes:
            return {
                "page": page_number,
                "boxes": embedded_boxes,
                "source": "embedded",
            }

        enhanced_image, threshold_image, image_width, image_height = _page_to_ocr_images(page)

        try:
            seen_boxes: set[tuple[int, int, int, int]] = set()
            boxes: list[dict[str, object]] = []

            for rotation in OCR_ROTATION_SEQUENCE:
                rotated_enhanced = enhanced_image.rotate(rotation, expand=True) if rotation else enhanced_image
                rotated_threshold = threshold_image.rotate(rotation, expand=True) if rotation else threshold_image
                primary_passes = [
                    _run_tesseract_data(rotated_enhanced, OCR_PRIMARY_CONFIGS[0]),
                    _run_tesseract_data(rotated_threshold, OCR_PRIMARY_CONFIGS[0]),
                ]

                for data in primary_passes:
                    boxes.extend(
                        _collect_pass_boxes(
                            data,
                            normalized_query_tokens,
                            image_width,
                            image_height,
                            seen_boxes,
                            rotation,
                        )
                    )

                if boxes:
                    for config in OCR_PRIMARY_CONFIGS[1:]:
                        for image in (rotated_enhanced, rotated_threshold):
                            boxes.extend(
                                _collect_pass_boxes(
                                    _run_tesseract_data(image, config),
                                    normalized_query_tokens,
                                    image_width,
                                    image_height,
                                    seen_boxes,
                                    rotation,
                                )
                            )
                    return {
                        "page": page_number,
                        "boxes": boxes,
                        "source": "ocr",
                    }

            boxes = []
            seen_boxes.clear()
            for rotation in OCR_ROTATION_SEQUENCE:
                rotated_enhanced = enhanced_image.rotate(rotation, expand=True) if rotation else enhanced_image
                rotated_threshold = threshold_image.rotate(rotation, expand=True) if rotation else threshold_image
                for config in OCR_PRIMARY_CONFIGS[1:]:
                    for image in (rotated_enhanced, rotated_threshold):
                        boxes.extend(
                            _collect_pass_boxes(
                                _run_tesseract_data(image, config),
                                normalized_query_tokens,
                                image_width,
                                image_height,
                                seen_boxes,
                                rotation,
                            )
                        )
                if boxes:
                    break
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

        return {
            "page": page_number,
            "boxes": boxes,
            "source": "ocr",
        }
    finally:
        document.close()


def extract_page_highlight_boxes(
    file_path: Path,
    page_number: int,
    query: str,
) -> dict[str, object]:
    return _extract_page_highlight_boxes_cached(str(file_path), page_number, query.strip())


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
