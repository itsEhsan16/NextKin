# Security checklist — local half (P13-01)

**2026-10-16 · owner role: Security lead**

Spec §16.6 lists the security checks Release 1 must pass. This file records how far each one is
proved on the local stack, with the evidence: a test or command anyone can re-run. Checks that
need AWS are marked **cloud** with their Connect item. Each one is re-proved on AWS at X-15.

Re-run all of it with:

```sh
pnpm stack:up && pnpm test:integration      # the suites named below
pnpm drills                                  # resilience (aws/drills/)
pnpm scan:secrets && pnpm scan:deps          # gitleaks, OSV-Scanner
```

## §16.6 line by line

| §16.6 check | Local status | Evidence |
| ----------- | ------------ | -------- |
| Authorization matrix per role, every route allowed and forbidden | **proved** | `authzMatrix.int.test.ts` (user routes; it fails on any route without a matrix row); `adminP12.int.test.ts` (every admin route as all seven roles, 746/746) |
| RLS: cross-user reads and writes fail; the app role cannot disable or bypass RLS | **proved** (local IdP sessions) | `rls.int.test.ts` (tables found from the catalog, the cross-user matrix, a pooled-connection leak test); `postgresRoles.int.test.ts`. With real Cognito sessions: **cloud, X-07** |
| Account linking in both orderings; no user-existence errors; session revocation | **proved** (mock issuers) | `authFederated.int.test.ts`; `contracts/identity.int.test.ts` (also runs against mock-oauth2 with `--profile auth`); `authSessions.int.test.ts` (logout, sign-out everywhere, password change) |
| Rate limits on auth, generation, assistant and presign | **proved** at the application layer | `rateLimitsP13.int.test.ts`: every named class, signed in and signed out, reaches 429 with `Retry-After` exactly at its limit; buckets are per route and per caller (it found the assistant sharing the generation bucket, fixed). `api.int.test.ts` covers the default class | `api.int.test.ts` (429 with `Retry-After` on the default class; every class is configured in `src/http/middleware/guards.ts`). The P13-03 load runs stayed inside the classes by design. WAF layer: **cloud, X-09** |
| Upload handling: POST policy size and type; unscanned or infected objects unreadable; type sniffing; no passthrough | **proved** | `contracts/files.int.test.ts`, `s3PresignedPost.int.test.ts`, `uploadsApi.int.test.ts` (EICAR quarantined; a scanner outage fails closed) |
| Dependency and secret scanning in CI | **built**; runs locally; CI wiring at X-06 | `pnpm scan:secrets` (gitleaks over history and tree, `.gitleaks.toml`); `pnpm scan:deps` (OSV-Scanner on `pnpm-lock.yaml`). Results below |
| Inspector image-scan gate | **exception** (cloud, X-06) | Trivy was not pulled locally (owner decision 2026-10-16: small tools only). The app images are not built locally either |
| `cdk-nag`, IAM Access Analyzer, Security Hub FSBP | **cloud, X-04 / X-15** | No infrastructure exists yet |
| Billing webhooks: signature checks and replay resistance | **proved** | `billingP12.int.test.ts` (forged signature 400; a replay is a no-op; out-of-order events tolerated) |
| Third-party penetration test | **recommended** before the first enterprise or partnership contract | Not a local item |

## Beyond §16.6 (plan P13-01)

| Check | Status | Evidence |
| ----- | ------ | -------- |
| Existence hiding: another user's id answers 404, never 403 | **proved** | `profileApi.int.test.ts`, `generationsApi.int.test.ts`. A malformed id now answers 404 too; before P13-03 the generation routes answered 500 (fixed) |
| OWASP ZAP baseline | **exception** | The ZAP image was not pulled (owner decision 2026-10-16). It runs against the first shared environment (X-06/X-15). Meanwhile, `test/kernel.test.ts` proves the API's headers (`nosniff`, `no-referrer`, CORP; `no-store` on authenticated responses). Pages now carry a CSP, `X-Frame-Options: DENY`, `nosniff`, a referrer policy, a permissions policy and COOP (`apps/web/proxy.ts`, `src/lib/securityHeaders.ts`; unit-tested). A Chromium run over 13 production pages found 0 CSP violations, framing from another origin blocked, and no `X-Powered-By` (toreview §105.21) |
| Degraded modes fail safe | **proved** | `degradedP13.int.test.ts`; drill record [2026-10-16](../drills/2026-10-16.md) |
| Errors never leak internals | **proved** | Database outages and pool exhaustion answer 503 `UNAVAILABLE`, and malformed literals 400, with no driver message (`src/http/app.ts` onError); resilience drills |

## Scan results, 2026-10-16

**gitleaks v8.24.0** (`pnpm scan:secrets`): history (68 commits) and working tree **clean**. The
first tree scan had 45 findings, all false positives, allowlisted in `.gitleaks.toml` with a reason
each:
- 39 in `apps/web/.next` (gitignored build output: jose's PEM format check, a FIXME string).
- 1 in the gitignored local `.env`, holding local stand-in values.
- Recorded AI fixtures, whose `key` is a content hash.
- 4 test placeholders: a made-up cursor secret, the RFC 6238 TOTP seed, and a fake refresh token.

**OSV-Scanner v2.0.0** (`pnpm scan:deps`): 27 advisories in 1,468 packages.
- **Fixed:** `next` 16.3.4 → **16.3.8**. That fixed seven advisories, including GHSA-vcvr-r3jv-pc5j
  (RCE in `next/og`) and GHSA-cjq9-62q9-8jv4 (image-optimizer SSRF). `eslint-config-next` moved
  with it. 16.4.x was skipped: it was under two weeks old.
- **Fixed:** `sharp` 0.35.4 → **0.35.5** (GHSA-wq5f-xc86-pv6w, librsvg), via a `pnpm-workspace.yaml`
  override until `next` requires it.
- **Triaged, not reachable at runtime (13 remain):**

| Package | Advisory | Pulled in by | Why it stays |
| ------- | -------- | ------------ | ------------ |
| brace-expansion 1.1.18, 5.0.9 | GHSA-6j4f / q2hr / qhr7 (DoS) | minimatch in eslint, jest, glob | Dev tooling on our own patterns |
| braces 3.0.3 | GHSA-vfj7 (DoS) | micromatch ← kysely-codegen (dev) | Dev only |
| js-yaml 3.15.1, 4.3.1 | GHSA-2883 (CPU) | eslintrc, jest, Expo config | Reads our own config files only |
| source-map-js 1.2.1 | GHSA-68fv (DoS) | postcss ← tailwind (build) | Build time only |
| svgo 3.3.4 | GHSA-4vpr, GHSA-w27v | Expo/Metro asset pipeline | Optimises our own SVGs at build time |
| compression 1.8.1 | GHSA-vc2v | Expo CLI dev server | Developer machine only |
| node-forge 1.4.0 | GHSA-86w9 | Expo CLI (dev certificates) | Developer machine only |
| shell-quote 1.10.0 | GHSA-pqg4 | React Native CLI | Developer machine only |
| sprintf-js 1.0.3 | GHSA-hp3w | argparse ← js-yaml 3 | Dev tooling |
| uuid 7.0.3 | GHSA-w5hq | Expo CLI | Dev only; the vulnerable `buf` argument is not used |
| decode-uri-component 0.2.2 | GHSA-vcc3 (DoS) | query-string ← expo-router | **In the app bundle.** A malformed deep link could stall the user's own app; it cannot reach the server or other users. Pinned by Expo SDK 57; moves with the SDK |

Re-triage on every `pnpm scan:deps` and every SDK or Next upgrade.
