# Uploads, scanning and parsing (P7)

How a document gets in safely and becomes a draft the user confirms.

**Audience:** engineers working on uploads, the parser, or the cloud adapters (S3 and GuardDuty at
X-05, Textract at X-14).

## The path of one resume

```
POST /uploads/presign      a row (pending) + a presigned POST: exact key, exact type, size ≤ 5 MB
browser / phone ─POST────▶ storage (S3 / SeaweedFS) refuses anything outside the policy
POST /uploads/:id/confirm  the object must exist → status scanning → outbox: upload.scan
worker: upload.scan        clamd INSTREAM → clean | infected (moved to quarantine/) | failed
                           the bytes must be what the purpose takes (sniffed, never the extension)
POST /resume-parse         waits for the scan (waiting_scan), queued once clean
worker: resume.parse       reading: the isolated parser thread (analyzer.ts)
                             visible text only; hidden text reported, never passed on
                             pages under 80 visible characters → page images → Tesseract
                           extracting: the model (fast tier) on the visible text
                           verifying: the deterministic cross-check against the same text
                           ready: draft + findings (hidden text, rejected, flagged)
POST /resume-parse/:id/apply   keep | merge (default) | replace, per section
```

## Guarantees and where they are proved

| Guarantee | Proved by |
|---|---|
| Storage itself refuses an oversized file, another content type, or another key | `contracts/files.int.test.ts` |
| EICAR is quarantined and never reaches the parser or the model | `uploadsApi.int.test.ts` |
| An unreachable scanner fails the upload; nothing is ever "clean" by default | `contracts/files.int.test.ts` |
| A file is what its bytes say: a PNG declared as a PDF is refused | `parsing.test.ts`, `uploadsApi.int.test.ts` |
| Hidden text: recall ≥ 95%, false positives ≤ 1% (120 synthetic PDFs) | `parsing.test.ts` (the P7-04 gate) |
| White text on a dark header band is visible, not hidden | `parsing.test.ts` |
| Hidden text is absent from every model payload and every draft (G9) | `parsing.test.ts`, `uploadsApi.int.test.ts` |
| Zip bombs and DOCTYPEs (XXE) are refused before parsing | `parsing.test.ts` |
| A timeout or out-of-memory parse fails the file, not the process | `parsing.test.ts` |
| PDF, DOCX, TXT and scanned PDFs all become drafts; an invented employer is caught | `uploadsApi.int.test.ts` |
| Abandoning a draft leaves the profile unchanged byte for byte | `uploadsApi.int.test.ts` |
| The teaser shows no total score (D-15); its files are gone after 24 hours | `uploadsApi.int.test.ts` |

## Decisions written down here

- **The OCR threshold is 80 visible characters per page** (`OCR_MIN_CHARS_PER_PAGE`). The spec
  gives none, so it is a judgement call (toreview §105.14):
  - a text resume page carries several hundred characters;
  - an image-only scan carries none.

  Only the images on pages under the threshold are OCRed. So a mixed document (a scanned page inside
  a text PDF) works, and a short last page with no image costs nothing.
- **No `getTextContent`.** pdfjs's text content keeps invisible and white text and silently drops
  off-page text, so the analyzer interprets the operator list itself (`pdf.ts`):
  - text matrix × CTM;
  - render mode and fill colour;
  - filled rectangles and images behind each run.
- **pdfjs-dist 6.4 contains no `eval` or `Function` constructor**: the CVE-2024-4367 path was
  removed. So there is no `isEvalSupported` option to set. A future upgrade should be grepped the
  same way.
- **DOCX is read from its XML** (fflate + fast-xml-parser with entities off). `mammoth` (pinned in
  `docker/versions.env`) is not used, because it cannot report the hidden runs.
- **Scanned PDFs are OCRed from their embedded page images.** No canvas or native dependency is
  needed. A PDF that draws its text as vector paths has neither text nor images; it fails as
  unreadable, with the plain message.
- **The draft keeps the client's `ProfileDraft` shape.** Dates stated only as a year become
  `YYYY-01-01`; the precision is not carried yet (P9's timeline engine needs it, and will add it).

## Running locally

- `pnpm stack:up -- --profile core --profile scan` adds ClamAV (392 MB, about 1 GB of RAM once its
  signatures load). Without it every upload ends `failed: We could not check this file`, never
  `clean`.
- The OCR models are vendored in `vendor/tessdata` (`tessdata_fast`, eng + deu, about 5.6 MB). Their
  hashes are checked before use.
- `test/fixtures/makePdf.ts` and `makeDocx.ts` build the synthetic fixtures.
  `generate-scanned.ts` regenerates the scanned résumé with a local Chromium.
- **Never put the EICAR test string in a file.** Windows Defender quarantines it, and so would CI
  scanners. `test/integration/fixtures/eicar.ts` assembles it at run time.
