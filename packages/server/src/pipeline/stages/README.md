# Generation (P9)

How a job description becomes a resume you can defend, claim by claim.

**Audience:** engineers working on the pipeline stages, the prompts, the claim ledger or the app
cutover.

## The path of one Build Resume

```
POST /jd {paste | uploadId}   a row (extracting) → outbox: jd.extract → the worker
worker: jd.extract            file → the P7 scan gate and isolated parser (visible text only)
                              the fast tier reads typed fields; every item must QUOTE the text
                              items whose quote is not in the text are dropped and counted
                              30-day cache jd:<prompt version>:<hash>: the same JD twice is one call
GET  /jd/:id                  the client polls until ready; PATCH stores the user's corrections
POST /generations {resume}    snapshot the profile as facts with ids (no contact field, G5),
                              fix asOf, create the resume row, enqueue the run
  jd        the confirmed JD (corrections on top of the extraction)
  plan      deterministic: per-role era-valid skills (§7.7 pre-filter), the requirement ledger
            over the profile (what is backed, where; what is a gap)
  generate  the generation tier writes summary, skills and bullets, each citing fact ids;
            employers, titles, dates and education are COPIED from the facts, never generated
  validate  claim ledger + timeline post-check → up to 2 rewrites of only the violating sections
            → what is still invented is stripped (G13); lint suggests; unknown tech → KB queue
  score     the P8 rubric with the profile as the yardstick; no total without a JD (D-15)
  persist   an immutable version (canonical JSON, claim ledger, timeline report) + its ATS report
GET  /generations/:id/result  the finished document as the apps model it
```

## Stages per kind

| Kind | Stages | Output |
|---|---|---|
| `resume` | jd → plan → generate → validate → score → persist | a version with its claim ledger, timeline report and ATS report |
| `resume`, tailored (`tailoring` on the request) | the same; `validate` then merges into the base version (`tailorMerge.ts`) | a new resume built from the picked one: what was switched off verbatim, the run's score and "what changed" on the generation |
| `zero_resume` | jd → zero → persist | every claim `assumed`, figures as `[N]`, no score; export stays blocked |
| `cover_letter` | jd → source → letter → persist | a letter version and its `cover_letters` row; paragraphs that still violate after one rewrite are dropped |
| `ats_check` | source → jd → score → persist | an ATS report on the source version, and the check's result on the run |
| `interview` | source → jd → ground → write → check → persist | a practice set: technical questions only on skills the resume claims and the JD asks for, none on a skill the timeline flagged or the resume does not back; padded from the behavioural bank to 10–20 |

Every stage is checkpointed by the P6 runner. A redelivered run resumes at the first stage the
checkpoint lacks, and `persist` reuses a version its generation already wrote.

## Guarantees and where they are proved

| Guarantee | Proved by |
|---|---|
| An unquoted requirement is dropped and counted; the same JD twice is one model call | `generationP9.int.test.ts` |
| What the user corrected is what generation reads | `generationP9.int.test.ts` |
| Every claim cites a fact; the ledger is clean; the score is the rubric's | `generationP9.int.test.ts` |
| A technology the role's dates rule out never reaches that role (pre-filter) | `generationP9.int.test.ts` |
| Fabricated claims are rewritten; what survives two rewrites is stripped, leaving zero untraceable hard facts | `generationP9.int.test.ts` |
| A crash after a stage resumes at the next one, without re-running the model or writing twice | `generationP9.int.test.ts` |
| Zero Resume: assumed, placeholder figures, no score, no name sent to the model | `generationP9.int.test.ts` |
| ≥ 99% of seeded fabrications are caught by the ledger (131/131) | `engines/test/adversarial/claimMutation.test.ts` |
| Both apps' client: JD → Build Resume → the document in the library | `generateApi.int.test.ts` |
| A tailored run's baseline is the comparison's; switched-off parts come back word for word; a keyword the user didn't tick never reaches the document | `tailorP14.int.test.ts`, `test/tailor.test.ts` |
| The golden set passes the bar; a degrading prompt edit fails it | `test/evals.test.ts` |

## Decisions written down here

- **The model writes claims, not facts.** The headers (employer, title, dates) and education come
  from the profile, so the largest class of fabrication never reaches the model's output at all.
- **Revisions are bounded at two,** and each is told exactly which claims failed and why. After
  that, code decides: hard facts are stripped, the rest flagged.
- **`asOf` is fixed at start** and stored with the run, so a retried stage judges dates exactly as
  the first attempt did (G12).
- **Formatting is assumed parse-safe** for every template until P10's certification measures it.
- **The headline is the model's,** within the facts: the claim ledger does not check it as a title.
  A tailored run aims it at the JD's title instead, or keeps the base's.
- **A tailored run's facts are the picked resume's own lines,** not the profile (toreview §110.3).
  Code merges what the model wrote into that resume; the model never decides what stays.
- **No Message Batches API yet** for KB candidates: one capped call each.

## Running and recording

- `pnpm eval` runs the golden set (see `evals/README.md`).
- Until a key exists, the pipeline suites use the scripted reference models in
  `evals/referenceModel.ts`. They test the pipeline's guarantees, not model quality.
