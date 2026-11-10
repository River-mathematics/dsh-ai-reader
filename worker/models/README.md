# DocLayout-YOLO model

`doclayout-yolo.onnx` is not committed to this repository (about 75 MB). It is
used by `worker/layout.py` to detect figures, tables, captions and text regions.

Source: <https://huggingface.co/wybxc/DocLayout-YOLO-DocStructBench-onnx>
Base model: <https://huggingface.co/juliozhao/DocLayout-YOLO-DocStructBench>

Download it with:

```bash
python worker/models/download.py
```

The model card lists Apache-2.0; the ONNX metadata also contains an AGPL-3.0
notice from the original Ultralytics export. Please verify the license that
applies to your redistribution before bundling the model.

If the model is absent, the worker does not guess: it returns no automatic
figure cards. The reader still works for text and the manual "框选图表" path.
