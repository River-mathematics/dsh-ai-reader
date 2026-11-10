#!/usr/bin/env python3
"""PyMuPDF worker for the DSH AI Reader.

Commands (one-shot, JSON printed on stdout):
  extract <pdf> <out.json>
  render  <pdf> <page-1based> <zoom> <out.png>
"""
from __future__ import annotations

import json
import os
import re
import sys

import pymupdf

try:  # OCR is optional: figure cards still work without it.
    from rapidocr_onnxruntime import RapidOCR
except Exception:  # noqa: BLE001
    RapidOCR = None

LIGATURES = {
    "\ufb00": "ff", "\ufb01": "fi", "\ufb02": "fl", "\ufb03": "ffi",
    "\ufb04": "ffl", "\ufb05": "st", "\ufb06": "st",
    "\u00ad": "", "\u2010": "-", "\u2011": "-", "\u2013": "-", "\u2014": "—",
    "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
}

_OCR_ENGINE = None


def clean_line(text: str) -> str:
    for source, target in LIGATURES.items():
        text = text.replace(source, target)
    return re.sub(r"[ \t]+", " ", text).strip()


def join_lines(lines: list[str]) -> str:
    out = ""
    for raw in lines:
        line = clean_line(raw)
        if not line:
            continue
        if not out:
            out = line
            continue
        if out.endswith("-") and len(out) > 1 and out[-2].isalpha() and line[:1].islower():
            out = out[:-1] + line
        elif re.search(r"[\u4e00-\u9fff]$", out) or re.match(r"^[\u4e00-\u9fff]", line):
            out += line
        else:
            out += " " + line
    return out


def page_blocks(page: pymupdf.Page) -> list[dict]:
    data = page.get_text("dict", flags=pymupdf.TEXTFLAGS_TEXT)
    raw: list[dict] = []
    for block in data.get("blocks", []):
        if block.get("type") != 0:
            continue
        lines: list[str] = []
        sizes: list[float] = []
        flags: list[int] = []
        for line in block.get("lines", []):
            text = "".join(span.get("text", "") for span in line.get("spans", []))
            if text.strip():
                lines.append(text)
            for span in line.get("spans", []):
                if span.get("text", "").strip():
                    sizes.append(float(span.get("size", 0) or 0))
                    flags.append(int(span.get("flags", 0) or 0))
        text = join_lines(lines)
        if len(text) < 2:
            continue
        x0, y0, x1, y1 = [float(v) for v in block.get("bbox", (0, 0, 0, 0))]
        if x1 - x0 < 2 or y1 - y0 < 2:
            continue
        raw.append({
            "text": text,
            "bbox": [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)],
            "fontSize": round(max(sizes) if sizes else 0, 2),
            "bold": bool(flags) and all((f & 16) != 0 for f in flags),
            "col": -1,
        })
    if not raw:
        return []

    width = float(page.rect.width)
    height = float(page.rect.height)
    considered = [b for b in raw if not (b["bbox"][1] < height * 0.045 and len(b["text"]) < 90)
                  and not (b["bbox"][3] > height * 0.955 and len(b["text"]) < 90)]
    chars = [len(b["text"]) for b in considered if len(b["text"]) > 20]
    if chars:
        lengths = sorted(chars)
        median_len = lengths[len(lengths) // 2]
        body = [b for b in considered if len(b["text"]) >= min(80, median_len)]
    else:
        body = considered
    sizes = sorted(b["fontSize"] for b in body if b["fontSize"] > 0)
    median_size = sizes[len(sizes) // 2] if sizes else 10.0

    for b in raw:
        x0, y0, x1, y1 = b["bbox"]
        if x1 <= width * 0.52:
            b["col"] = 0
        elif x0 >= width * 0.48:
            b["col"] = 1
        else:
            b["col"] = -1

    # Reading order: full-width blocks split the page into horizontal bands;
    # inside a band read the left column, then the right column.
    full = sorted([b for b in raw if b["col"] == -1], key=lambda b: (b["bbox"][1], b["bbox"][0]))
    ordered: list[dict] = []
    cursor_y = -1.0
    for divider in full + [None]:
        limit = divider["bbox"][1] if divider is not None else height + 1000
        band = [b for b in raw if b["col"] >= 0 and b["bbox"][1] >= cursor_y and b["bbox"][1] < limit]
        for col in (0, 1):
            for b in sorted([x for x in band if x["col"] == col], key=lambda x: (x["bbox"][1], x["bbox"][0])):
                ordered.append(b)
        if divider is not None:
            ordered.append(divider)
            cursor_y = divider["bbox"][3]

    # Merge PyMuPDF's occasional split paragraphs (conservative).
    merged: list[dict] = []
    for b in ordered:
        prev = merged[-1] if merged else None
        if prev is not None and prev["col"] == b["col"] and b["col"] >= 0:
            p0, p1, p2, p3 = prev["bbox"]
            b0, b1, b2, b3 = b["bbox"]
            gap = b1 - p3
            overlap = max(0.0, min(p2, b2) - max(p0, b0))
            min_width = max(1.0, min(p2 - p0, b2 - b0))
            same_size = abs(prev["fontSize"] - b["fontSize"]) < 1.2
            ends_sentence = bool(re.search(r"[.!?;:]$", prev["text"]))
            starts_lower = bool(b["text"][:1].islower())
            if -2.0 <= gap <= 2.5 and overlap / min_width > 0.65 and same_size and (starts_lower or not ends_sentence):
                prev["text"] = join_lines([prev["text"], b["text"]])
                prev["bbox"] = [min(p0, b0), min(p1, b1), max(p2, b2), max(p3, b3)]
                prev["fontSize"] = max(prev["fontSize"], b["fontSize"])
                prev["bold"] = prev["bold"] and b["bold"]
                continue
        merged.append(dict(b))

    result = []
    small_labels = sum(1 for b in merged if b["fontSize"] < 8.6 and len(b["text"]) < 100)
    dense_graphics = small_labels >= 8
    for index, b in enumerate(merged):
        text = b["text"].strip()
        if len(text) < 2:
            continue
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) < 2:
            continue
        y0, y1 = b["bbox"][1], b["bbox"][3]
        role = "body"
        if re.fullmatch(r"\d{1,4}", text) and y0 > height * 0.90:
            role = "footer"
        elif y1 < height * 0.05 and len(text) < 120:
            role = "header"
        elif y0 > height * 0.95 and len(text) < 120:
            role = "footer"
        elif re.match(r"^(figure|fig\.|table)\s*\d+", text, re.I) and len(text) < 500:
            role = "caption"
        elif len(text) < 180 and (b["fontSize"] >= median_size * 1.12 or (b["bold"] and b["fontSize"] >= median_size * 1.03)):
            role = "heading"
        elif dense_graphics and b["fontSize"] < 8.6 and len(text) < 100:
            role = "label"
        else:
            symbols = sum(1 for ch in text if ch in "=+−×÷∼∈∂∇∫∑√≤≥θαβγπσμλ∥𝔼𝒩")
            if len(text) < 140 and symbols / max(1, len(text)) > 0.055:
                role = "formula"
            elif len(text) < 200 and sum(ch.isdigit() for ch in text) / max(1, len(text)) > 0.16:
                role = "table"
        if page.number == 0 and role == "body" and y0 < height * 0.34 and len(text) < 500:
            role = "meta"
        result.append({
            "id": f"b{index + 1}",
            "text": text,
            "bbox": b["bbox"],
            "role": role,
            "fontSize": b["fontSize"],
        })
    return result


def _area(rect: pymupdf.Rect) -> float:
    return max(0.0, rect.width) * max(0.0, rect.height)


def _intersection(a: pymupdf.Rect, b: pymupdf.Rect) -> float:
    return _area(a & b)


def _merge_rect(a: pymupdf.Rect, b: pymupdf.Rect) -> pymupdf.Rect:
    return pymupdf.Rect(
        min(a.x0, b.x0), min(a.y0, b.y0),
        max(a.x1, b.x1), max(a.y1, b.y1),
    )


def _column(rect: pymupdf.Rect, width: float) -> int:
    return 0 if (rect.x0 + rect.x1) / 2 < width / 2 else 1


def _has_graphics(rect: pymupdf.Rect, graphics: list[pymupdf.Rect], images: list[pymupdf.Rect]) -> bool:
    minimum = max(80.0, _area(rect) * 0.012)
    for shape in graphics + images:
        if _intersection(rect, shape) >= minimum:
            return True
    return False


def _caption_near(rect: pymupdf.Rect, captions: list[dict], width: float) -> dict | None:
    candidates = []
    for block in captions:
        cb = pymupdf.Rect(block["bbox"])
        # Prefer captions below the figure, then above it (table captions are often above).
        below = -40.0 <= cb.y0 - rect.y1 <= 120.0
        above = -40.0 <= rect.y0 - cb.y1 <= 120.0
        if not (below or above):
            continue
        if _column(cb, width) != _column(rect, width) and rect.width < width * 0.62:
            continue
        distance = abs(cb.y0 - rect.y1) if below else abs(rect.y0 - cb.y1)
        candidates.append((distance, 0 if below else 1, block))
    if not candidates:
        return None
    candidates.sort(key=lambda item: (item[1], item[0]))
    return candidates[0][2]


def _after_block(rect: pymupdf.Rect, blocks: list[dict], width: float) -> str | None:
    column = _column(rect, width)
    wide = rect.width > width * 0.62
    candidates = []
    for block in blocks:
        if block.get("role") in {"header", "footer", "caption"}:
            continue
        bb = pymupdf.Rect(block["bbox"])
        if bb.y1 > rect.y0 + 4:
            continue
        if not wide and _column(bb, width) != column:
            continue
        candidates.append(block)
    if not candidates:
        return None
    return max(candidates, key=lambda block: block["bbox"][3])["id"]


def _normalise_ocr_box(box, width: float, height: float) -> list[float]:
    xs = [float(point[0]) for point in box]
    ys = [float(point[1]) for point in box]
    x0, x1 = max(0.0, min(xs)), min(width, max(xs))
    y0, y1 = max(0.0, min(ys)), min(height, max(ys))
    if x1 <= x0 or y1 <= y0:
        return [0.0, 0.0, 0.0, 0.0]
    return [round(x0 / width, 4), round(y0 / height, 4),
            round((x1 - x0) / width, 4), round((y1 - y0) / height, 4)]


def ocr_figure(path: str, width: float, height: float) -> tuple[list[dict], str | None]:
    """Best-effort OCR of a figure crop. Returns (lines, error)."""
    global _OCR_ENGINE
    if os.environ.get("DSH_AI_READER_OCR", "1") == "0":
        return [], None
    if RapidOCR is None:
        return [], "RapidOCR 未安装（pip install -r worker/requirements-ocr.txt）"
    try:
        if _OCR_ENGINE is None:
            _OCR_ENGINE = RapidOCR()
        result, _ = _OCR_ENGINE(path)
    except Exception as error:  # noqa: BLE001
        return [], f"OCR 失败：{type(error).__name__}: {error}"
    lines: list[dict] = []
    seen: set[tuple[str, int, int]] = set()
    for item in result or []:
        try:
            box, value, score = item[0], str(item[1]), float(item[2])
        except Exception:  # noqa: BLE001
            continue
        text = clean_line(value)
        if len(text) < 2 or score < 0.32:
            continue
        if re.fullmatch(r"[\d\s.,%+\-−–—/()]+", text):
            continue  # numerical axis ticks do not need translation
        bbox = _normalise_ocr_box(box, width, height)
        if bbox[2] <= 0 or bbox[3] <= 0:
            continue
        key = (text, round(bbox[0] * 20), round(bbox[1] * 20))
        if key in seen:
            continue
        seen.add(key)
        lines.append({
            "text": text,
            "confidence": round(score, 3),
            "bbox": bbox,
        })
    lines.sort(key=lambda line: (line["bbox"][1], line["bbox"][0]))
    return lines[:50], None


def _cluster_shapes(shapes: list[pymupdf.Rect], caption: pymupdf.Rect, table: bool) -> list[pymupdf.Rect]:
    """Shapes touching the caption, walking away from it through small gaps."""
    remaining = list(shapes)
    selected: list[pymupdf.Rect] = []
    current = caption.y1 if table else caption.y0
    for _ in range(120):
        hit = None
        for shape in remaining:
            if table:
                if shape.y0 <= current + 18 and shape.y1 >= current - 6 and shape.y1 > caption.y1 + 2:
                    hit = shape
                    break
            else:
                if shape.y1 <= current + 6 and shape.y1 >= current - 18 and shape.y0 < caption.y0 - 2:
                    hit = shape
                    break
        if hit is None:
            break
        remaining.remove(hit)
        selected.append(hit)
        if table:
            current = max(current, hit.y1)
        else:
            current = min(current, hit.y0)
        if abs(current - (caption.y1 if table else caption.y0)) > 360:
            break
    return selected


def page_figures(page: pymupdf.Page, blocks: list[dict], fig_dir: str, page_number: int) -> list[dict]:
    """Find figure/table regions, crop them and OCR their text."""
    width = float(page.rect.width)
    height = float(page.rect.height)
    page_area = max(1.0, width * height)

    data = page.get_text("dict", flags=pymupdf.TEXTFLAGS_TEXT)
    images: list[pymupdf.Rect] = []
    for block in data.get("blocks", []):
        if block.get("type") != 1:
            continue
        rect = pymupdf.Rect(block.get("bbox", (0, 0, 0, 0))) & page.rect
        area = _area(rect)
        if rect.width < 50 or rect.height < 30:
            continue
        if area / page_area < 0.004 or area / page_area > 0.72:
            continue
        if area / page_area < 0.02 and (rect.y1 < height * 0.08 or rect.y0 > height * 0.92):
            continue
        images.append(rect)

    graphics: list[pymupdf.Rect] = []
    try:
        for drawing in page.get_drawings():
            rect = pymupdf.Rect(drawing.get("rect", (0, 0, 0, 0))) & page.rect
            if _area(rect) >= 12:
                graphics.append(rect)
    except Exception:  # noqa: BLE001
        graphics = []

    tables: list[pymupdf.Rect] = []
    try:
        found = page.find_tables()
        for table in found.tables:
            rect = pymupdf.Rect(table.bbox) & page.rect
            if _area(rect) / page_area >= 0.008:
                tables.append(rect)
    except Exception:  # noqa: BLE001
        tables = []

    captions = [block for block in blocks if block.get("role") == "caption"]
    regions: list[dict] = []

    for rect in images:
        regions.append({"rect": rect, "kind": "figure"})
    for rect in tables:
        regions.append({"rect": rect, "kind": "table"})

    # Caption-anchored detection catches vector figures and tables that PyMuPDF
    # does not expose as image blocks.
    for caption in captions:
        cap = pymupdf.Rect(caption["bbox"])
        text = str(caption.get("text") or "")
        is_table = bool(re.match(r"^(table|表)\s*\d+", text, re.I))
        column = _column(cap, width)
        wide = cap.width > width * 0.62
        x0 = width * 0.04 if wide or column == 0 else width * 0.50
        x1 = width * 0.96 if wide or column == 1 else width * 0.50
        search = pymupdf.Rect(x0, 0, x1, height)
        shapes = [shape for shape in graphics + images + tables
                  if _intersection(shape, search) > 4
                  and min(shape.x1, search.x1) - max(shape.x0, search.x0) > 12]
        if is_table:
            nearby = [table for table in tables
                      if table.y0 >= cap.y1 - 8 and table.y0 < cap.y1 + 140
                      and min(table.x1, cap.x1) - max(table.x0, cap.x0) > 20]
            if nearby:
                # find_tables() already gives a tighter region; the caption
                # region here would swallow the following tables on the page.
                continue
            below = [b for b in blocks if b.get("role") not in {"caption", "header", "footer"}
                     and pymupdf.Rect(b["bbox"]).y0 > cap.y1 + 2]
            next_block = min(below, key=lambda b: b["bbox"][1]) if below else None
            y0 = cap.y1 + 3
            y1 = min(height * 0.94, (next_block["bbox"][1] - 3) if next_block else cap.y1 + 250)
            cluster = _cluster_shapes(shapes, cap, True)
            if cluster:
                y1 = max(y1, min(height * 0.94, max(shape.y1 for shape in cluster) + 4))
        else:
            above = [b for b in blocks if b.get("role") not in {"caption", "header", "footer"}
                     and pymupdf.Rect(b["bbox"]).y1 < cap.y0 - 2]
            prev_block = max(above, key=lambda b: b["bbox"][3]) if above else None
            y1 = cap.y0 - 3
            y0 = max(height * 0.04, (prev_block["bbox"][3] + 3) if prev_block else cap.y0 - 250)
            cluster = _cluster_shapes(shapes, cap, False)
            if cluster:
                y0 = min(y0, max(height * 0.04, min(shape.y0 for shape in cluster) - 4))
        if y1 - y0 < 55:
            continue
        rect = pymupdf.Rect(x0, y0, x1, y1) & page.rect
        if rect.width < 80 or rect.height < 55:
            continue
        if not _has_graphics(rect, graphics, images):
            continue
        regions.append({"rect": rect, "kind": "table" if is_table else "figure", "captionBlockId": caption["id"]})

    # Merge overlapping regions; a raster figure and its caption region are one card.
    regions.sort(key=lambda item: (item["rect"].y0, item["rect"].x0))
    merged: list[dict] = []
    for item in regions:
        rect = item["rect"]
        hit = None
        for existing in merged:
            inter = _intersection(rect, existing["rect"])
            if inter > 0 and inter / max(1.0, min(_area(rect), _area(existing["rect"]))) > 0.18:
                hit = existing
                break
        if hit is None:
            merged.append({"rect": pymupdf.Rect(rect), "kind": item["kind"],
                           "captionBlockId": item.get("captionBlockId")})
        else:
            hit["rect"] = _merge_rect(hit["rect"], rect)
            if item.get("captionBlockId") and not hit.get("captionBlockId"):
                hit["captionBlockId"] = item["captionBlockId"]
            if item["kind"] == "table":
                hit["kind"] = "table"

    # A table is often detected as several row fragments; join fragments that
    # share a caption and are vertically adjacent in the same column.
    merged.sort(key=lambda item: (item["rect"].y0, item["rect"].x0))
    compact: list[dict] = []
    for item in merged:
        if compact:
            prev = compact[-1]
            ra, rb = prev["rect"], item["rect"]
            same_caption = prev.get("captionBlockId") and prev.get("captionBlockId") == item.get("captionBlockId")
            same_table = prev.get("kind") == "table" and item.get("kind") == "table"
            x_overlap = min(ra.x1, rb.x1) - max(ra.x0, rb.x0)
            gap = max(rb.y0 - ra.y1, ra.y0 - rb.y1)
            if (same_caption or same_table) and x_overlap > min(ra.width, rb.width) * 0.60 and gap <= 30:
                prev["rect"] = _merge_rect(ra, rb)
                if item["kind"] == "table":
                    prev["kind"] = "table"
                continue
        compact.append({
            "rect": pymupdf.Rect(item["rect"]),
            "kind": item["kind"],
            "captionBlockId": item.get("captionBlockId"),
        })
    merged = compact

    figures: list[dict] = []
    for index, item in enumerate(merged):
        rect = item["rect"] & page.rect
        if _area(rect) / page_area > 0.80:
            continue
        caption = None
        if item.get("captionBlockId"):
            caption = next((block for block in captions if block["id"] == item["captionBlockId"]), None)
        if caption is None:
            caption = _caption_near(rect, captions, width)
        if caption and re.match(r"^(figure|图)\s*\d+", str(caption.get("text") or ""), re.I):
            item["kind"] = "figure"
        elif caption and re.match(r"^(table|表)\s*\d+", str(caption.get("text") or ""), re.I):
            item["kind"] = "table"
        label = f"图 {index + 1}" if item["kind"] != "table" else f"表 {index + 1}"
        figure_id = f"f{index + 1}"
        image_name = f"p{page_number:04d}-{figure_id}.png"
        image_path = os.path.join(fig_dir, image_name)
        matrix = pymupdf.Matrix(2.6, 2.6)
        pix = page.get_pixmap(clip=rect, matrix=matrix, alpha=False, annots=True)
        pix.save(image_path)
        ocr, ocr_error = ocr_figure(image_path, pix.width, pix.height)
        figures.append({
            "id": figure_id,
            "kind": item["kind"],
            "label": label,
            "bbox": [round(rect.x0, 2), round(rect.y0, 2), round(rect.x1, 2), round(rect.y1, 2)],
            "width": pix.width,
            "height": pix.height,
            "file": f"figures/{image_name}",
            "captionBlockId": caption["id"] if caption else None,
            "caption": str(caption["text"]).strip() if caption else "",
            "afterBlockId": _after_block(rect, blocks, width),
            "ocr": ocr,
            "ocrError": ocr_error,
        })
    return figures


def extract(pdf_path: str, out_path: str) -> dict:
    doc = pymupdf.open(pdf_path)
    meta = doc.metadata or {}
    title = (meta.get("title") or "").strip()
    if not title or title.lower() in {"untitled", "microsoft word", "unknown"}:
        title = os.path.splitext(os.path.basename(pdf_path))[0]
    fig_dir = os.path.join(os.path.dirname(out_path) or ".", "figures")
    os.makedirs(fig_dir, exist_ok=True)
    pages = []
    figure_count = 0
    for index, page in enumerate(doc):
        blocks = page_blocks(page)
        # Drop stale crops from a previous extraction of this page.
        prefix = f"p{index + 1:04d}-"
        for name in os.listdir(fig_dir):
            if name.startswith(prefix) and name.endswith(".png"):
                try:
                    os.remove(os.path.join(fig_dir, name))
                except OSError:
                    pass
        figures = page_figures(page, blocks, fig_dir, index + 1)
        figure_count += len(figures)
        pages.append({
            "page": index + 1,
            "width": round(float(page.rect.width), 2),
            "height": round(float(page.rect.height), 2),
            "blocks": blocks,
            "figures": figures,
        })
    outline = []
    try:
        for level, heading, page_number in doc.get_toc(simple=True):
            outline.append({"level": int(level), "title": str(heading).strip(), "page": int(page_number)})
    except Exception:
        outline = []
    result = {"title": title, "pageCount": len(pages), "pages": pages, "outline": outline}
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False)
    return {"ok": True, "pages": len(pages), "figures": figure_count, "out": out_path}


def render(pdf_path: str, page_number: str, zoom: str, out_path: str) -> dict:
    doc = pymupdf.open(pdf_path)
    index = max(0, min(len(doc) - 1, int(page_number) - 1))
    page = doc[index]
    z = max(0.5, min(4.0, float(zoom)))
    pix = page.get_pixmap(matrix=pymupdf.Matrix(z, z), alpha=False, annots=True)
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    pix.save(out_path)
    return {"ok": True, "page": index + 1, "width": pix.width, "height": pix.height}


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    try:
        command = sys.argv[1] if len(sys.argv) > 1 else ""
        if command == "extract" and len(sys.argv) >= 4:
            result = extract(sys.argv[2], sys.argv[3])
        elif command == "render" and len(sys.argv) >= 6:
            result = render(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
        else:
            result = {"ok": False, "error": "usage: main.py extract <pdf> <out.json> | render <pdf> <page> <zoom> <out.png>"}
    except Exception as error:  # noqa: BLE001 - the protocol needs a JSON error
        result = {"ok": False, "error": f"{type(error).__name__}: {error}"}
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
