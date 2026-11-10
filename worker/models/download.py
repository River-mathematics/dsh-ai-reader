#!/usr/bin/env python3
"""Download the optional DocLayout-YOLO ONNX model."""
from __future__ import annotations

import os
import urllib.request

URL = 'https://huggingface.co/wybxc/DocLayout-YOLO-DocStructBench-onnx/resolve/main/doclayout_yolo_docstructbench_imgsz1024.onnx'
TARGET = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'doclayout-yolo.onnx')


def main() -> int:
    if os.path.isfile(TARGET) and os.path.getsize(TARGET) > 1_000_000:
        print(f'already exists: {TARGET} ({os.path.getsize(TARGET)} bytes)')
        return 0
    os.makedirs(os.path.dirname(TARGET), exist_ok=True)
    print(f'downloading {URL}')
    with urllib.request.urlopen(URL, timeout=300) as response, open(TARGET, 'wb') as handle:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            handle.write(chunk)
    print(f'saved: {TARGET} ({os.path.getsize(TARGET)} bytes)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
