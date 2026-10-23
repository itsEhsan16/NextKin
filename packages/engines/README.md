# @nextkin/engines — the deterministic quality core (P8)

Every judging step, as versioned, pure code. These engines decide whether a technology fits a
role's dates, whether a JD requirement is met, what the score is and which fixes are honest. Models
read and write prose; they never decide a number (G14).

**Audience:** engineers working on scoring, validation, the KB or the rubric, and anyone wiring the
engines into the server (P9) or the apps.

## The rules every file here keeps

Lint enforces these (`eslint.config.js`):
- **No clock.** "Present" is the `asOf` argument, which every report records.
- **No randomness, network, process, Node built-ins or `Intl`.**
- **Integers.** Weights and scores are basis points; ordering is by code point.

So the same input gives byte-identical output on Hermes, on V8 and months later (G12). The phone
can import them too: `packages/shared`'s mock does, so it can no longer contradict the real
engine (C-10).

**Import files directly** (`@nextkin/engines/rubric`), never the index. Plain Node (tsx) cannot see
`export *` names.

## The modules

| File | What it decides | Plan |
|---|---|---|
| `provenance.ts` | Rubric versions (frozen, pinned); the G12 stamp; `content_change` vs `method_change` | P8-01 |
| `normalizer.ts` + `datasets/taxonomy.ts` | Written skill → canonical id: an alias trie over tokens, ambiguity rules | P8-02 |
| `kb.ts` + `datasets/kb.ts` | The Technology KB; only approved entries can hard-fail | P8-03 |
| `timeline.ts` | Invalid / Suspect / Valid / Unverified per technology claim; the pre-filter and post-check | P8-04 |
| `plausibility.ts` | Claims that cannot be true: a JD asking more years of a technology than it has existed, a resume claiming them, backwards or future dates, a stated total past the dated roles | toreview §129 |
| `placement.ts` | Where a ticked skill is said: the closest dated role whose dates fit it, so the plan measures the step at the role the screen names | toreview §129 |
| `targetPlan.ts` | The path to a target score: real steps (the user's confirmations and figures, the AI's own fixes) applied cumulatively and re-scored after each; the honest ceiling and what caps it | toreview §129 |
| `substitutions.ts` | Era-fitting alternatives; never applied without `{ confirmed: true }` | P8-05 |
| `requirements.ts` | The requirement ledger: D-14 tiers, years from dated roles, eligibility flags | P8-06 |
| `document.ts`, `quantified.ts`, `rubric.ts`, `fixes.ts` | The five-part score, no total without a JD, typed fixes with re-scored impact | P8-07 |
| `markets.ts`, `lint.ts` | US / DE / AU profiles; advisory lint that never scores | P8-08 |
| `text.ts`, `dates.ts`, `canonical.ts`, `bps.ts` | Tokens with offsets; partial dates; canonical JSON and fingerprints; basis points | — |

## Guarantees and where they are proved

| Guarantee | Test |
|---|---|
| §16.2's case families: before release, before adoption, boundary years, unknown technology, overlapping roles, open-ended roles, KB pinning | `timeline.test.ts` |
| Verdicts follow §7.7 exactly for every approved entry and year, and never move backwards as a role ends later (fast-check) | `timeline.test.ts` |
| A machine-generated KB entry cannot produce Invalid | `timeline.test.ts` |
| An ask within a technology's age is never flagged (fast-check); a machine-generated entry only flags; rubric-2 caps an impossible ask and leaves a fair one unchanged | `plausibility.test.ts`, `provenance.test.ts` |
| A path's last total is exactly a plain re-score of every step applied; a skill is only ever a step the user confirms; a thin resume reaches 85 | `targetPlan.test.ts` |
| A stored report is unchanged by a later KB edit, and records its KB version | `timeline.test.ts` |
| Substitutions are never written without a confirmation | `timeline.test.ts` |
| The labelled surface-form table passes; zero false positives on the ambiguity list; "go-to-market" never resolves to Go | `normalizer.test.ts` |
| "5+ years" against three computed years is partial; eligibility never moves points; repetition and order change nothing; text copied from the JD earns nothing | `requirements.test.ts` |
| Re-scoring the same input returns an identical result; an unresolved hard fail zeroes the timeline component; no total without a JD | `rubric.test.ts` |
| A gap is never insertable and worth no points; a fix's impact is a re-score | `rubric.test.ts` |
| No source file, field or output names a third-party ATS | `rubric.test.ts` |
| A weight change is a new version; stored runs reproduce byte for byte | `provenance.test.ts` |
| en-AU spelling for an Australian JD, en-US for a US one; lint never changes a score | `lint.test.ts` |
| Zero gaming wins: stuffing, repetition, unbacked skills, pasted JD text, hidden text, era-invalid claims | `adversarial/gaming.test.ts` |
| A nurse's resume against a backend JD has a 0% match | `adversarial/gaming.test.ts` |
| Name, gender, age, nationality, photo and marital status change nothing; adding a backed skill never lowers the score, removing one never raises it | `adversarial/invariance.test.ts` |
| Seeded fabrications are caught, and the catch rate is printed on every run | `adversarial/mutation.test.ts` |

`pnpm test` runs with coverage and fails below the thresholds in `vitest.config.ts`. `timeline.ts`
must keep 100% of lines and at least 95% of branches.

## Decisions written down here

- **The starter taxonomy and KB are hand-authored and machine-generated.** By the owner's decision
  (toreview §105.15), the KB entries can only flag until a named curator approves them. The
  licensed import (O\*NET, Wikidata, ESCO) is P9-07's.
- **The KB holds technologies only:** languages, frameworks, libraries, databases, cloud, DevOps
  and tools. Practices and design skills are not timeline claims.
- **Rubric-1's numbers:**
  - weights 40 / 20 / 15 / 15 / 10;
  - bands 85 / 70 / 55;
  - D-14 credit: demonstrated 100%, listed 50%, unbacked 0;
  - a requirement shown for fewer years than asked earns 50%;
  - required weighs 2, preferred 1.

  Changing any of them is a new rubric version (G15).
- **Formatting facts are inputs.** For a generated document they will come from template
  certification (P10); for an upload, from the P7 analyzer.
- **The scorer never sees contact values.** Contact is three booleans, so no detail enters the
  engines (G5) and no protected attribute can move a score.

## Adding to the method

- **A new rubric version:** add it to `RUBRICS` in `provenance.ts`, add its fingerprint to the
  pinned list in `provenance.test.ts`, and run the adversarial suite. A draft can be evaluated
  first by passing `rubric` to `score()`.
- **A new skill or alias:** add it to `datasets/taxonomy.ts`. Mark a one-word ordinary name
  `ambiguous`, or a single alias `~`. Add a positive row, and a negative row if it is ambiguous, to
  `normalizer.test.ts`.
- **A KB change:** a new `kb-x.y.z` version. Stored reports keep the version they name.
