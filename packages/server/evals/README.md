# Evals (P9-06)

The golden set and the release gate (V2 §16.4).

**Audience:** engineers changing a prompt, a model route, an engine or the pipeline; and whoever runs
the live evaluation.

## What runs

`golden.ts` holds golden-0.1.0: 30 synthetic pairs, each a profile with fact ids plus a JD. There are
ten archetypes × three JDs, labelled by family (`matched`, `anachronism`, `gap`, `sparse`, `german`,
`switcher`) and market (US, DE, AU). Each JD carries gold labels for extraction precision and recall.
It is a synthetic starter set (L4); the content lane extends or replaces it with reviewed pairs.

`harness.ts` sends every pair through the production code: JD extraction with span verification, the
plan, generation, the validation loop (ledger, bounded revision, strip) and the rubric. It measures:

| Metric | Bar | What it means |
|---|---|---|
| anachronisms | 0 | technology claims the role's dates rule out, in the final document |
| untraceableHardFacts | 0 | from the claim ledger, never a model's opinion |
| gapInsertions | 0 | JD requirements the profile does not back, written in |
| strippedClaims | 0 | claims the model still invented after two rewrites |
| revisionRate | ≤ 20% | share of pairs whose first draft needed a rewrite |
| supportedRecall | ≥ 80% | share of the requirements the profile backs that the resume shows |
| extractionPrecision / Recall | ≥ 90% / ≥ 80% | JD extraction against the gold labels |

The gate fails on any miss. `stripped` and `revisionRate` keep a careless model visible even though
the pipeline strips what it invents, so a degrading prompt fails the gate (`test/evals.test.ts`).

## Commands

- `pnpm eval`: the reference model (the default until recordings exist).
- `pnpm eval -- --recorded`: replays `evals/recordings`. CI uses this once a live run has recorded
  them.
- `pnpm eval -- --live`: the direct Claude API (D-23), recording every answer into
  `evals/recordings`.
  - Needs `ANTHROPIC_API_KEY` in the root `.env`.
  - Synthetic data only.
  - Stops at `AI_DAILY_CAP_USD`, $10 by the owner's decision.
- `pnpm eval -- --openrouter`: the same live run through OpenRouter (toreview §108).
  - Needs `OPENROUTER_API_KEY` in the root `.env`.
  - Same models, cap and recordings as `--live`.
- `--only backend-1,nurse-2` runs a subset.

Each run writes `evals/last-report.json` (gitignored), with the money spent on live calls.

## Before the live run counts

- **The 5.5 prices are carried over from their predecessors [verify],** so the cap is approximate
  until they are checked.
- **D-01 (Opus vs Sonnet) needs one live run per model.** Change the `resume_generate` route and rerun.
- **The nightly schedule waits for X-11.** Until then the live run is on demand.
