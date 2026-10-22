# Tesseract language data (ImBackendImplementationPlan P7-06)

`tessdata_fast` models, vendored so OCR runs the same on a Windows host, in CI and in the worker
image, with no download at run time. Source: github.com/tesseract-ocr/tessdata_fast at commit
`87416418657359cb625c412a48b6e1d6d41c29bd`, fetched 2026-10-11. Licence: Apache-2.0.

| File | Bytes | SHA-256 |
|---|---|---|
| `eng.traineddata` | 4,113,088 | `7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2` |
| `deu.traineddata` | 1,525,436 | `19d219bbb6672c869d20a9636c6816a81eb9a71796cb93ebe0cb1530e2cdb22d` |

The OCR adapter checks both hashes before it loads them. To move to `tessdata_best`, replace the
files, update this table and `TESSDATA_SHA256` in `src/ocr/tesseract.ts`.
