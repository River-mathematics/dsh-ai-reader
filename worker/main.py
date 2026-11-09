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

LIGATURES = {
    "\ufb00": "ff", "\ufb01": "fi", "\ufb02": "fl", "\ufb03": "ffi",
    "\ufb04": "ffl", "\ufb05": "st", "\ufb06": "st",
    "\u00ad": "", "\u2010": "-", "\u2011": "-", "\u2013": "-", "\u2014": "—",
    "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
}


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


def extract(pdf_path: str, out_path: str) -> dict:
    doc = pymupdf.open(pdf_path)
    meta = doc.metadata or {}
    title = (meta.get("title") or "").strip()
    if not title or title.lower() in {"untitled", "microsoft word", "unknown"}:
        title = os.path.splitext(os.path.basename(pdf_path))[0]
    pages = []
    for index, page in enumerate(doc):
        pages.append({
            "page": index + 1,
            "width": round(float(page.rect.width), 2),
            "height": round(float(page.rect.height), 2),
            "blocks": page_blocks(page),
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
    return {"ok": True, "pages": len(pages), "out": out_path}


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
