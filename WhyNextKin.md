# Why NextKin — an honest review of the backend plan

**Written 2026-10-12.** Three questions were asked: does the plan extract a resume correctly into
the profile and ask when something is missing; does it present and match a job description
against what the user needs; and is the result more than another resume builder. Each answer below
says what the spec promises, what the code already does (P0–P10 built, P11 in progress, see
`toreview.md` §105), what is still unproven, and what I would add.

The short version:

| Question                                               | Answer                                                                                                                                                                              |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extract a resume and map it to the profile?            | **Yes, and it is built.** Upload → scan → parse → model extraction → deterministic cross-check → a draft the user confirms per section. Nothing enters the profile unconfirmed.          |
| Ask the user a question when there is a gap?           | **No.** Neither the spec nor the plan has a "gap interview". There are nudges (completeness meter, `ask_for_number` fixes, Zero Resume flags), but nobody asks "when did this role end?" |
| Present the JD correctly?                              | **Yes.** Typed requirements, each quoting the JD, split required/preferred, editable before use. What the user confirms is what generation reads.                                     |
| Analyse and filter jobs by what the user needs?        | **Partly.** It scores skills-fit deterministically and labels the basis. It does **not** read the user's preferences (location, remote, salary) into the ranking, and has no deal-breakers. |
| More than a resume builder?                            | **Yes, if the truth layer is made visible.** The claim ledger, timeline engine, published rubric and parse-back are real and tested — and no competitor shows them. Today the UI hides most of it. |

---

## 1. Resume → profile

### What the spec promises (§7.3, §7.4)

Upload PDF/DOCX/TXT, scanned PDFs through OCR, malware-scanned, extracted by a model into a strict
schema, then a guardrail pass that checks dates and employers against the source text. Review is
mandatory: side by side with the source, accept / edit / reject per entry, keep / replace / merge
when it conflicts with the existing profile. Abandoning review leaves the profile byte for byte
unchanged. The profile (§7.3) is the single source of truth every resume is generated from.

### What is built (P7, `toreview.md` §105.14)

All of it, on the local stack:

- `packages/server/src/parsing/` — magic-byte sniffing, PDF via the operator list with hidden-text
  detection (invisible, background-coloured, tiny, off-page), DOCX from its XML with zip-bomb and
  DOCTYPE guards, OCR through Tesseract when a page has under 80 visible characters.
- `parsing/extract.ts` — the model reads the visible text only, contact details redacted (G5).
- `parsing/crossCheck.ts` — employers, dates and skills the text does not state are **rejected**;
  reworded titles are **flagged**. An injected fake employer was caught in the tests.
- `services/resumeParse.ts` — the draft lives apart from the profile; applied per section as keep,
  merge or replace. Dedupe on merge: roles by company + title, education by institution, skills by
  canonical id.
- Facts carry provenance: `user` / `parsed_confirmed` / `assumed` (migration 0002).

Proved: PDF, DOCX, TXT and a scanned PDF each became a draft end to end; hidden-text recall ≥ 95%
on 120 synthetic PDFs; EICAR never reaches a parser; abandoning a draft changes nothing.

### What is thin or missing

1. **No live model run yet.** Every extraction so far ran on scripted answers (`toreview.md`
   §105.16 "Not proved"). The pipeline's *guarantees* are proved; the *quality* of real parsing is
   not. This is one `ANTHROPIC_API_KEY` in `.env` away.
2. **No real resumes.** The golden set is 30 synthetic pairs. The consented corpus (M1-16) needs
   cloud storage and a DPA. Real resumes are messier than fixtures: two-column layouts, tables,
   headers repeated per page, "Present" in five spellings, dates like "Summer 2019".
3. **No per-field confidence.** The cross-check gives `verified / flagged / rejected`, which is a
   good proxy, but the spec's "low-confidence items are flagged" (§7.4) is only partly there: a
   field the model *guessed* that happens to appear in the text passes as verified.
4. **Exact-match merge only.** "Google" and "Google LLC", or "Sr. Engineer" and "Senior Engineer",
   land as two roles. A second upload of a slightly edited resume will double the timeline.
5. **Year-only dates become `YYYY-01-01`** in the draft; precision is not carried through yet.
6. **Mobile device import is unproved** (expo-file-system upload from Expo Go against SeaweedFS).

### Asking questions when there is a gap — the real gap

The spec never requires it. Gaps are handled passively:

- a completeness meter listing missing items (§7.3);
- `ask_for_number` fixes on bullets without a metric (`packages/engines/src/fixes.ts`);
- `Profile.skillWarnings` for era-invalid or unknown skills (P9-05);
- Zero Resume `assumed` placeholders that block export until resolved (§7.9).

Nothing detects: a role with no end date, a gap of more than N months between roles, a role with
no skills tagged, a skill in the list that no role demonstrates (which under D-14 earns almost
nothing), education with no year, a title the model reworded. And nothing turns those into
questions. The user discovers each one only when a score is lower than they expected.

**Verdict:** the extraction is more careful than any product in this category I know of. The
"ask when there is a gap" part is not designed. Proposal in §4.1 below.

---

## 2. Job description → match → "jobs I should care about"

### What the spec promises (§7.5, §7.8, §7.13)

Paste or upload a JD (no URL fetch, D-17). Extract title, company, required vs preferred skills,
responsibilities, tools, domain, experience level, location/remote if stated. Show it in an
editable review screen beside the original; confirmed fields drive generation. Per-JD "NextKin
Score" on a published rubric (40 keyword / 20 timeline / 15 sections / 15 formatting / 10
quantified), JD match reported separately with "x of y required". A live board (Adzuna, JSearch)
with search filters: keyword, location, work mode, salary, date posted. Match on each card,
deterministic, labelled "indicative".

### What is built (P8, P9, P11 in progress)

- **JD intake** (`services/jd.ts`, `pipeline/stages/extractJd.ts`): paste up to 20,000 chars or a
  file. Each requirement must quote the JD; a requirement with no span is dropped and counted
  (`extraction.dropped`). 30-day cache per content hash. German JDs read (D-11). Extraction
  precision 97.2% / recall 96.1% — against the scripted model, so treat as pipeline proof only.
- **`JdDraft`** (`packages/shared/src/models/jd.ts`): `requiredSkills`, `preferredSkills`,
  `responsibilities`, `tools`, `domain`, `experienceLevel`, `employmentType`, `language`, typed
  `requirements[]` with `kind: 'skill' | 'eligibility'`, `minYears`, `span`.
- **Normalizer** (`packages/engines/src/normalizer.ts`): alias trie, no `\b` regexes, ambiguity
  rules so "go-to-market" never resolves to Go. **Taxonomy: 181 skills, hand-authored starter.**
  The licensed seed (O*NET, Wikidata, ESCO) is a content-lane task not yet done.
- **Requirement ledger** (`requirements.ts`): met / partial / gap / eligibility; D-14 evidence tiers
  (role-backed > skills list > summary); years computed from dated role tags; text pasted from
  the JD earns nothing; eligibility never moves points.
- **Rubric** (`rubric.ts`): the five weights, no total without a JD (D-15), match % separate with
  "x of y required", a `weak` band, typed fixes with impact simulated by re-scoring.
- **Timeline engine + KB** (`timeline.ts`, `datasets/kb.ts`): 127 machine-generated entries,
  flag-only until a curator approves them.
- **Adversarial suite**: 131/131 seeded fabrications caught; stuffing, repetition, hidden text and
  pasted-JD text win nothing.

### What is thin or missing

1. **The JD extractor does not read what the user actually cares about.** There is no field for
   salary, remote/hybrid/onsite, visa sponsorship, benefits, start date, team size, or
   contract length. `location` is a free string. Eligibility is a flag on a requirement, not a
   structured answer to "can I even apply?".
2. **Preferences exist but nothing reads them.** `ProfilePreferences` has `locations`, `remote`,
   target roles and industries (`packages/shared/src/models/profile.ts:81`). The jobs repo sorts
   "Top Job Matches" by `matchScore` then date (`packages/shared/src/repos/jobsRepo.ts:165`) and
   "Today's picks" is an editorial flag sorted by date. The server-side `matchScore.ts` (P11)
   uses the same skill matcher. **No ranking uses location, remote, salary or seniority fit, and
   there are no deal-breakers.** "Filter according to how strong it matches user needs" today
   means "skill overlap".
3. **No live job provider.** D-12 (budget) is open, so P11 runs on a fixture catalogue with INR
   listings. Adzuna/JSearch adapters, country selector and currency-aware salary filter wait.
4. **Small vocabulary.** 181 skills covers the fixtures and common tech. A real JD for a nurse, an
   accountant or a mechanical engineer will mostly fall to "unverified". The spec's personas
   (§5) are IT-heavy, so this is tolerable at launch, but it caps who the product is for.
5. **No related-skill graph.** The career-switcher promise (§5.2, "how real experience maps onto
   the target domain") rests on `substitutions.ts`, which draws from KB relations — 127 entries.
6. **The score tension the plan itself names** (backend plan §8): timeline, sections and
   formatting are nearly always full on a generated resume, so about half the 100 points arrive
   before the JD is considered; a candidate with half the required skills still lands near 75.
   The plan's answer is to lead with "x of y required". That is right, but only if the UI does it.

**Verdict:** the JD is presented *correctly* — better than correctly, since every requirement
quotes its source. The *match* is honest about skills. It is not yet a "does this job fit me"
engine, because it never reads the user's own constraints. Proposal in §4.3.

---

## 3. Is it more than another resume builder?

The resume-builder category's documented failures (spec §3.4): fabricated skills lifted from the
JD, corrupted dates, anachronistic technology, gameable keyword scores, templates that fail parsing,
hidden paywalls. NextKin's answer to each is **built and tested**, not promised:

| Failure in the category                 | NextKin mechanism                                                        | Status                       |
| --------------------------------------- | ------------------------------------------------------------------------ | ---------------------------- |
| Invented employers, titles, dates       | Copied from facts, never generated; claim ledger strips the rest (G13)   | Built, 131/131 caught        |
| Skills pasted from the JD               | A `gap` fix is `insertable: false`; pasted JD text earns nothing (G16)   | Built, adversarial suite     |
| 2015 graduation becomes 2025            | Dates are profile facts, checked by the ledger                           | Built                        |
| "Used Kubernetes in 2011"               | Timeline engine, deterministic, KB-dated                                 | Built; KB flag-only until curated |
| Gameable keyword score                  | Evidence-weighted coverage (D-14), published rubric, re-score identical  | Built                        |
| Pretty template, unreadable by ATS      | Every export re-parsed and compared with the canonical model (Q-06)      | Built (P10), one template    |
| "Beats Workday"                         | Forbidden in copy, field names and metrics (G4)                          | Rule, enforced in tests      |
| Hidden export paywall                   | Clean PDF free and unlimited (§13)                                       | Built (P10-07)               |

No resume builder I know of does the first four at all, and none publishes a rubric. **This is a
real moat — but it is an invisible one.** A user who uploads a resume and gets a tailored PDF sees
the same thing they would see from any competitor. The value only shows when:

- the UI says *"we left out Terraform because no role of yours shows it — add the role or tag it"*
  instead of silently scoring lower;
- the score leads with *"4 of 7 required, 2 partial, 1 gap"* and names them;
- the export shows *"re-parsed: 100% of sections readable"*;
- the profile page shows *"3 facts assumed, 2 parsed but not confirmed"*.

The backend plan knows this (§7 item 5, "the honest-fix UI and copy… gates each cutover") and
marks it design-gated front-end work. **That work is the product.** Without it the backend's
honesty is a cost (lower numbers than competitors) with no visible benefit.

Second thing a resume builder lacks and the spec has: **the loop.** JD → resume for that job →
score → interview questions grounded in what the resume claims → assistant that knows the ledger.
It is a job-search workspace, not a document editor. But the most requested piece of that loop —
*did I apply, what happened* — is Release 2 (§6.2 application tracking), and the apps already
render it from mock. §4.4 below.

**Verdict:** yes, genuinely different, provided (a) the honest-fix UI ships with each cutover and
(b) the loop closes with at least a light application record.

---

## 4. What I would add — simpler to use, more useful

Ordered by value per effort. Each says whether it fits Release 1 under the spec, or needs a
decision. None changes the engines' rules (G13–G18); all of them *use* those rules.

### 4.1 The gap interview (the missing piece from question 1)

After parse review, run a **deterministic gap detector** over the confirmed profile and turn each
finding into one question. Code decides what to ask; the model only phrases it (G14).

| Detector (pure, in `packages/engines`)                       | Question the user sees                                                                  |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Role with no end date and not marked current                 | "Are you still at Acme? If not, when did it end?"                                       |
| Gap > 3 months between consecutive roles                     | "There's a gap between Jan–Aug 2023. Study, break, freelance, or just not on the resume?" (answer becomes a `user` fact; shown only if they choose) |
| Role with zero skills tagged                                  | "What did you mainly use at Acme? Pick from these the JD mentions: …"                   |
| Skill in the list that no dated role demonstrates (D-14)     | "You list Kubernetes but no role shows it. Which role, or was it a course?"             |
| Bullet with no number (`ask_for_number`, already exists)     | "How many users / how much faster / what size team?" — one field, never invented        |
| Title flagged as reworded by the cross-check                 | "Your resume says 'Sr. Eng', we read 'Senior Engineer' — which should appear?"          |
| Education with no year                                       | "What year did you finish?"                                                             |

Rules: ≤ 7 questions per session, skippable, each answer written with `provenance: user`,
re-score after. Fits Release 1: it is §7.3's completeness nudges made conversational, no new
visual language needed (a list of cards with one input each). Mobile already has an assistant
surface; the questions can live there.

### 4.2 Make the first five minutes work

A new user should get a result before they build a profile.

- **Upload → three facts the user confirms → one tailored resume.** Not the full parse review for
  every field. Confirm employers and dates (the hard facts), accept the rest as
  `parsed_confirmed`, let the gap interview clean up later.
- **"Paste a JD or skip"** on the first screen; without one, show the parts and findings (D-15),
  never a total. Already the engine's behaviour; make the empty state *say why* ("add a job to see a
  score — we don't guess").
- **One progress bar for the whole pipeline** with the stage names (already real events, P6-13).
  Users forgive 45 s if they can see "checking dates against your profile".

### 4.3 "Fit", not just "match" (the missing piece from question 2)

Add a small, deterministic **fit layer** on top of the skill match, read from `ProfilePreferences`
and from JD fields the extractor should gain:

- Extend `JdDraft` with `workMode`, `salary {min,max,currency,period}`, `sponsorship: yes|no|unknown`,
  `startDate`, `contractLength`. Each with a span, same rule as every other field.
- Extend preferences with `salaryFloor`, `needsSponsorship`, `maxCommute`/`relocate`, `excludedCompanies`.
- Rank with three separate labels, never blended into the ATS score (G17): **Skills** (x of y),
  **Fit** (location ✓ remote ✓ salary ? sponsorship ✗), **Eligibility** (may be screened out).
- Deal-breakers hide, not demote: "12 jobs hidden — 9 need sponsorship, 3 under your floor".
  One tap shows them.
- "Why this job" in one line, from the ledger: "Matches React, Node, 4 yrs; missing GraphQL".

Spec says the "AI job-match engine" is Release 2 (§6.2). This is not that — it is deterministic
filtering on fields the user typed — but it should still be recorded as a decision because it
changes §7.13's scope. Needs D-12 (job providers) to matter on real listings.

### 4.4 Close the loop lightly: "I applied"

Application tracking is Release 2, and both apps already render it from mock. The cheapest honest
version for Release 1: a `jobs.setStatus(jobId, 'applied' | 'interview' | 'rejected' | 'offer')`
with a date, nothing else. No reminders, no email parsing. It gives the dashboard its only real
number ("8 applied this month"), the interview module a reason to open ("you have an interview at
Acme — practise these 6"), and the user a reason to come back. Needs the client's sign-off (D-05).

### 4.5 Show the truth layer (the missing piece from question 3)

The honest-fix UI the plan defers. Minimum set, in priority order:

1. **Score card leads with "x of y required"**, then the five parts, then "what this does not
   measure". The 0–100 total third, never first.
2. **Every fix says its basis**: "Add 'TypeScript' to the Acme role — you tagged it there" vs
   "GraphQL: not in your profile. We won't add it. Have you used it?" (→ gap interview).
3. **Provenance chips on the profile**: confirmed / parsed / assumed, with one tap to confirm.
4. **Export receipt**: "Re-parsed: 5/5 sections, 23/23 bullets readable. Template: NextKin Classic
   (certified)."
5. **"What changed and why"** between versions: "removed 'led migration' — no role of yours
   contains a migration; added 'Docker' to Acme — tagged there".

All of it is copy plus existing primitives; the data is already in `AtsScore`, `Fix`, the ledger
and the parse-back result.

### 4.6 One profile, many resumes — show drift

The persona in §5.1 sends twenty tailored resumes. The ledger already guarantees they share one
history. Surface it: a "variants" view of one base resume listing each JD, its x-of-y, and the date,
with "regenerate all against the current profile" when a fact changes. Nothing new in the backend
beyond a list query.

### 4.7 Smaller things that remove friction

- **Share-sheet / clipboard paste on mobile**: open the app with a JD on the clipboard → "Use this
  job description?". No URL fetch needed (D-17 stays).
- **Re-score as you type** in the editor (< 10 s is already the budget; debounce to 2 s).
- **"Explain this term"** on any JD requirement, from the Skills Explorer KB entry, inline.
- **Interview prep from gaps, not just matches**: the question the user fears is about the
  requirement they *don't* meet; §7.15 forbids questions about flagged skills, but a "how to talk
  about a gap honestly" prompt is advice, which §7.16 allows.
- **Plain-language score bands** at the top of every list: weak / fair / good, with the number
  on tap. Less to read on a phone.
- **A "what we never do" page** linked from the score: no invented facts, no JD keyword stuffing,
  no named-ATS claims, free clean PDF. It is the marketing, and under §7.8 it is also true.

### 4.8 What I would *not* add

- Auto-apply or bots (§3.5 rules it out, and it is what gets accounts banned).
- An LLM-produced "overall fit" number. G14 forbids it and it would be the first thing to drift.
- A bigger template library before parse-back certification can measure each one.
- LinkedIn import before the real-resume corpus proves the parser on real files.

---

## 5. What must happen before any of this is believable

In order:

1. **Put the Claude key in `.env` and run `pnpm eval -- --live`.** Every quality number above is
   measured against a scripted model until then.
2. **Get real resumes** (M1-16 corpus with consent; needs cloud storage + DPA). Then re-check the
   OCR threshold, the white-text heuristic, the fuzzy-merge gap and the taxonomy coverage.
3. **Seed the licensed taxonomy** (O*NET / Wikidata / ESCO) so the normalizer covers non-IT roles.
4. **Have a curator approve the KB**, or the timeline engine stays flag-only and the headline
   differentiator is a warning, not a gate.
5. **Decide D-12** so the match runs on real listings, and decide D-05 if §4.4 is wanted in
   Release 1.
6. **Ship the honest-fix UI with each cutover** (backend plan §7 item 5). This is the single most
   important front-end item in the project.

Files this review drew on: `doc/NextKin-Apply-V2-Project-Specification.md` §7.3–§7.8, §7.13,
§3.4, §6.2; `doc/ImBackendImplementationPlan.md` P7–P11; `doc/NextKin-Backend-Implementation-Plan.md`
§4, §5, §7, §8; `toreview.md` §105.14–§105.18; `packages/engines/src/{fixes,requirements,rubric,
normalizer}.ts`, `packages/engines/src/datasets/{taxonomy,kb}.ts`; `packages/shared/src/models/{jd,
profile}.ts`; `packages/shared/src/repos/jobsRepo.ts`.
