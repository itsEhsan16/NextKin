# Documents and export (P10)

How a version in the library becomes a file a recruiter can open, and why the file can be trusted.

**Audience:** engineers working on templates, the renderers, parse-back, export delivery or the
library's edit routes.

## The library

- **A resume is a container; each version is frozen.** Every change writes a new `resume_versions`
  row: an edit, a typed fix, a restore, a Zero Resume answer, a section regeneration. Each row
  carries:
  - the canonical JSON;
  - its claim ledger and timeline report;
  - its ATS report when the document was scored before, under the current method (Q-01).
- **Edits keep evidence.** The apps edit their editor model. `@nextkin/shared/scoring/canonicalEdits`
  writes a section back so that a line left alone keeps its claim, and a changed or new line becomes
  a `user` claim (Q-03).
- **Restore** writes version n+1 with the old body. Free sees the last 3 versions and Pro the last
  20; older versions are locked, never deleted.
- **Delete is permanent,** because the apps say so: the files go first, by reference, then the rows.
  The 30-day trash (trash, untrash, `trash_purge`) is built on the server for a future trash screen.
- **Regenerating a section** is a `section` run on the worker (jd → plan → generate → validate →
  persist). It lays only that section over the version as it stands now, and the apps' generation
  list never shows it.

## The path of one export

```
POST /resumes/:id/exports {format}   gates, in order: an open Zero Resume review → DOCX on Free
                                     (PLAN_LOCKED) → an unverified email → the accuracy confirmation
                                     (EXPORT_BLOCKED, details.reason). Then an export_events row and
                                     an outbox message; an existing render of the same version,
                                     format and template is reused.
worker: export.render                canonical JSON → render model (model.ts) → PDF | DOCX | TXT
                                     parse-back against the same model (Q-06) → exports bucket
                                     users/<user>/exports/<version>/<export>.<format>
GET /exports/:id                     ready: a presigned GET, at most 15 minutes, attachment-named
                                     FirstName_LastName_JobTitle.ext
```

## Renderers

| File | What it does |
|---|---|
| `model.ts` | The one model every renderer reads: conventional headings, market date formats (Q-07), no tables or columns. `expectedLines` is what parse-back checks. |
| `templates.ts` | Trusted HTML and CSS; user content is escaped. NextKin Classic is single-column in Liberation Sans. `two-column-test` is never offered: it proves certification rejects columns. |
| `renderPdf.ts` | Chromium, kept warm. JavaScript is off, and every request is refused except the bundled fonts. Tagged PDF. The render time Chromium stamps is replaced with the version's own time, so output is byte-identical. |
| `renderDocx.ts` | `docx` 9.7. It declares Arial, the font Liberation Sans stands in for. Real headings and a real bullet list; no tables, text boxes, images, headers or footers. |
| `renderTxt.ts` | Plain text in the same order, for a portal's paste box. |
| `parseBack.ts` | Reads a PDF by position, line by line, as a simple ATS does, and DOCX and TXT as text. Every line of the model must be found, in order. |
| `certify.ts` | A full synthetic resume through a template in all three formats; certified only with zero section loss. |

## Guarantees and where they are proved

| Guarantee | Proved by |
|---|---|
| Restore is n+1 and history stays; free sees 3 versions, the rest locked | `libraryP10.int.test.ts` |
| An edit keeps untouched claims, records its checks and re-scores in under 10 s | `libraryP10.int.test.ts` |
| A stale If-Match writes nothing (412) | `libraryP10.int.test.ts` |
| Only a skill the profile backs can be applied as a fix | `libraryP10.int.test.ts` |
| A cover letter cites only facts its source resume shows | `libraryP10.int.test.ts` |
| A Zero Resume review ends with the profile filled, and blanks are refused verbatim | `libraryP10.int.test.ts` |
| Byte-identical PDFs under 10 s; real text in reading order | `exportsP10.int.test.ts`, `pnpm --filter @nextkin/server render-check` in the image |
| Classic certifies in PDF, DOCX and TXT; two columns fail | `exportsP10.int.test.ts`, `render-check` |
| The gates hold in order; links last at most 15 minutes; renders are reused per version | `exportsP10.int.test.ts` |
| Delete and the day-31 purge remove the files; day 29 keeps them | `exportsP10.int.test.ts` |
| Both apps' client: list, edit, regenerate, confirm, download, write from, delete | `libraryApi.int.test.ts` |

## Running locally

- The worker renders with Chromium. In the container, Playwright's own build is installed. Locally,
  set `CHROMIUM_PATH` in the root `.env` to a downloaded Chromium (for example
  `ms-playwright/chromium-1234`).
- `render-check` (in the image: `node dist/render-check.mjs`) prints the PDF's hash, so two
  machines can be compared.
- The fonts are in `packages/server/assets/fonts`, under the SIL OFL 1.1 (see the licence file
  there).
