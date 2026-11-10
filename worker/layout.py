"""DocLayout-YOLO wrapper for the AI Reader worker.

The model is optional: when worker/models/doclayout-yolo.onnx is absent the
worker falls back to the older PyMuPDF heuristics. The model source and license
are documented in models/README.md.
"""
from __future__ import annotations

import os

import cv2
import numpy as np

try:
    import onnxruntime as ort
except Exception:  # noqa: BLE001
    ort = None

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models', 'doclayout-yolo.onnx')
INPUT_SIZE = 1024
CONFIDENCE = 0.30
NAMES = [
    'title', 'plain text', 'abandon', 'figure', 'figure_caption',
    'table', 'table_caption', 'table_footnote', 'isolate_formula', 'formula_caption',
]


class LayoutBox:
    __slots__ = ('kind', 'confidence', 'bbox')

    def __init__(self, kind: str, confidence: float, bbox: list[float]):
        self.kind = kind
        self.confidence = confidence
        self.bbox = bbox

    def as_dict(self) -> dict:
        return {'kind': self.kind, 'confidence': round(float(self.confidence), 4),
                'bbox': [round(float(v), 2) for v in self.bbox]}


def _iou(a, b) -> float:
    x0, y0 = max(a[0], b[0]), max(a[1], b[1])
    x1, y1 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x1 - x0) * max(0.0, y1 - y0)
    area_a = max(0.0, a[2] - a[0]) * max(0.0, a[3] - a[1])
    area_b = max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])
    return inter / max(1.0, area_a + area_b - inter)


class LayoutDetector:
    def __init__(self, model_path: str | None = None):
        self.model_path = model_path or MODEL_PATH
        self.available = False
        self.session = None
        if ort is None or not os.path.isfile(self.model_path):
            return
        try:
            self.session = ort.InferenceSession(self.model_path, providers=['CPUExecutionProvider'])
            self.input_name = self.session.get_inputs()[0].name
            self.available = True
        except Exception:  # noqa: BLE001
            self.session = None

    def _infer(self, rgb: np.ndarray) -> list[dict]:
        if not self.session:
            return []
        height, width = rgb.shape[:2]
        scale = min(INPUT_SIZE / height, INPUT_SIZE / width)
        resized_w, resized_h = int(round(width * scale)), int(round(height * scale))
        resized = cv2.resize(rgb, (resized_w, resized_h), interpolation=cv2.INTER_LINEAR)
        canvas = np.full((INPUT_SIZE, INPUT_SIZE, 3), 114, dtype=np.uint8)
        left = (INPUT_SIZE - resized_w) // 2
        top = (INPUT_SIZE - resized_h) // 2
        canvas[top:top + resized_h, left:left + resized_w] = resized
        tensor = canvas.astype(np.float32) / 255.0
        tensor = np.transpose(tensor, (2, 0, 1))[None]
        output = self.session.run(None, {self.input_name: tensor})[0]
        boxes = []
        for row in output[0]:
            if len(row) < 6 or float(row[4]) < CONFIDENCE:
                continue
            cls = int(row[5])
            if cls >= len(NAMES):
                continue
            x0 = max(0.0, min(width, (float(row[0]) - left) / scale))
            y0 = max(0.0, min(height, (float(row[1]) - top) / scale))
            x1 = max(0.0, min(width, (float(row[2]) - left) / scale))
            y1 = max(0.0, min(height, (float(row[3]) - top) / scale))
            if x1 - x0 < 8 or y1 - y0 < 8:
                continue
            boxes.append({
                'kind': NAMES[cls],
                'confidence': float(row[4]),
                'bbox': [x0, y0, x1, y1],
            })
        # The exported model is usually NMS-free; keep a light per-class NMS for
        # robustness against duplicate anchors.
        kept = []
        for box in sorted(boxes, key=lambda item: item['confidence'], reverse=True):
            if any(other['kind'] == box['kind'] and _iou(other['bbox'], box['bbox']) > 0.65 for other in kept):
                continue
            kept.append(box)
        return kept

    def detect_page(self, page, zoom: float = 2.0) -> list[dict]:
        """Return boxes in PDF point coordinates."""
        if not self.available:
            return []
        try:
            pix = page.get_pixmap(matrix=__import__('pymupdf').Matrix(zoom, zoom), alpha=False, annots=True)
            rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
            rgb = rgb[:, :, :3]
            found = self._infer(rgb)
        except Exception:  # noqa: BLE001
            return []
        result = []
        for box in found:
            x0, y0, x1, y1 = box['bbox']
            result.append({
                'kind': box['kind'],
                'confidence': box['confidence'],
                'bbox': [x0 / zoom, y0 / zoom, x1 / zoom, y1 / zoom],
            })
        return result
