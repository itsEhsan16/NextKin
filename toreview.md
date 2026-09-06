# To review

Things that need a decision, a check on a device, or a second opinion before we call the mobile
app done. Nothing here is a bug in the sense of "the gate is red" — `pnpm typecheck && pnpm lint
&& pnpm test` is green at every commit. These are the calls that were made without you, the ones
that were deliberately deferred, and the ones only a real device can settle.

Add to this file whenever a judgement call gets made rather than burying it in a commit message.

**Status:** Phases 9A–9H shipped. Five placeholder destinations remain: the four 9I flows
(`menu`, `history`, `interview-prep`, `ai-assistant`) and `resume-sort`, which is item 2 below.

---

## 1. Decisions I made that are yours to overrule

### 1.1 The `resumesUsed` cap is a meter, not a gate

The Resumes tab draws **"2 of 2 free resumes used"** (Figma 1:1388) and the fixture account is
already at that limit. But only `generationStart` moves the counter — `create` (Start from
scratch), `duplicate` and `importFromFile` all add a document without touching it. So a free user
who cannot generate can still make unlimited documents by hand.

I did **not** enforce it. Two reasons: RESUMES 03's Duplicate row is a *designed* control with no
gate, so enforcing the cap only on the undesigned screens would contradict an artboard (CLAUDE.md
rule 7); and gating it would put the demo account permanently behind an upsell it can never clear,
which would read as broken in Expo Go.

**Decide:** either the counter counts *stored* documents and every creator bumps it (Duplicate
included), or the label stops saying "resumes used" and becomes something it is actually
measuring. This is a design decision, not a build one.

### 1.2 DOCX is written as plain text under a `.txt` name

DOCX cannot be rendered on device under Expo Go. Rather than hand back a `.docx` that is really
plain text and will not open, the Pro export path writes the text rendition as `.txt` and the
toast says so. Free plans see the row locked, per §13.3/§13.5.

**Decide:** is that the right honesty trade, or would you rather the row said "DOCX arrives by
email" (which would be inventing a backend behaviour), or that DOCX not appear on mobile at all
(which would lose §13.5's visible-but-locked upsell)?

### 1.3 No `react-hook-form`, no `zod`

Both are installed but used nowhere. Every form built in 9C and 9F uses `useState` plus pure
validators in their own module (`sectionEdits.ts`, `profileForms.ts`, `chipEdits.ts`,
`identityForm.ts`, `zeroResume.ts`). Reason: CLAUDE.md rule 7 says a spec-derived screen is built
from patterns the codebase already has, and there was no forms idiom to follow. The validators are
directly unit-testable without mounting a page, which matches how `monthYearMath` and
`sheetKeyboardMath` are done.

**Decide:** keep it, or adopt RHF+zod before 9G adds more forms. If we keep it, the two
dependencies should be removed from `package.json`.

### 1.4 Prices are in INR; the spec publishes USD/EUR/AUD

`plansFixture` is ₹0 / ₹1,499 per month / ₹7,999 per year, for consistency with the Indian-market
copy everywhere else (Bengaluru, lakh salaries). V2 §13.2 publishes USD/EUR/AUD bands and defers
India (§6.2). The annual CTA reads **₹7,999/yr**, not a derived "₹667/mo", because ₹7,999 is one
charge and a monthly-looking figure would name a price nothing ever bills.

**Decide:** whether the real pricing table should replace the fixture before launch.

### 1.5 "ATS score" vs the spec's "NextKin Score"

Logged since 9B and still open. Every built screen says "ATS score" (RESUMES 04's own label);
V2 §7.8 mandates "NextKin Score". The built vocabulary stands behind a single `SCORE_LABEL`
constant in `src/data/models/resume.ts`, so changing it is a one-line change.

**Decide:** which vocabulary ships.

### 1.6 Sharing a job carries no link

`Job` has `companyWebsite` but no URL for the listing itself, and the ingest sources
(`adzuna`, `jsearch`, `manual`) do not supply one in the fixtures. So "Share this job" sends the
role, the company, the location and the work arrangement as text, and no link.

I did not use `companyWebsite` as a stand-in: a share that looks like a job posting and opens
stripe.com is worse than one that plainly names the role.

**Decide:** add `applyUrl` to `Job` (and to the fixtures) so the share carries the posting, or
accept that a shared job is a text handoff.

### 1.7 The Discover location control labels, it does not filter

Picking a city or "Remote only" changes the header chip and **nothing else** — the job list is
unchanged. That is what the designed screen does: JOBS 01 draws this control reading
"Bengaluru, India" over a list containing Zoho in Chennai and Linear at "Remote (India)", and the
store seeds it the same way (`location` is "Bengaluru, India" while `INITIAL_FILTERS.locations`
is empty). The header names where you are, not what you are filtered to.

Making it filter is a **design** change, not a wiring one: it would drop Chennai and remote roles
out of the seeded Discover list the artboard specifies. It would also need the label and
`filters.locations` written in one action so they cannot disagree, a `locations` case in
`appliedFilterChips` so the filter is removable, and `clearFilters` resetting the label with it.

**Decide:** leave it as a label (and consider wording it so it does not read like a filter), or
make it filter and accept a different seeded Discover list than JOBS 01 draws.

---

## 2. Gaps in the plan itself

These are things the approved plan does not schedule anywhere. Each needs a home before we can
say Phase 9 is complete.

| Gap | Detail | Suggested home |
|---|---|---|
| `resume-sort` | A placeholder key in no phase table. Same `OptionSheet`-over-the-tab-bar shape as the jobs sort sheet. | 9H, beside `job-sort` |
| Version history | `useRestoreVersion` and `useResumeVersions` exist and work; **nothing consumes them**. The editor shows "v3" with no way to see or restore the other two, and §7.11 requires append-only history to be visible. | needs a phase |
| Rewrite a letter in another tone | 9D built the tone picker for a *new* letter. The editor's `LetterBody` deliberately has none, because regenerating spends a cover-letter generation and §13.5 wants the cap on screen first. So an existing letter cannot be rewritten in another tone at all. | needs a phase |
| Zero Resume cap | §13.3 publishes "Zero Resume drafts: 1/month on Free" as its own row. `SubscriptionUsage` has no counter for it, so `/create/zero-resume` meters against the generations quota instead. | data-layer change |
| Saved-jobs cap | §13.3 says "Up to 10" on Free. Home's fixture ships 18 saved jobs and the job fixtures 12; both predate the cap and neither is enforced. | fixtures + 9H |
| Saved-jobs sort is client-side | `listSaved(sort?)` on the repo can order the list, but `useSavedJobs()` takes no argument and query hooks were off limits during the 9H build, so the Saved tab sorts in the screen. Harmless at 12 rows; wrong the moment the list is paged. | a query-layer change |

---

## 3. Never verified on a device

**Nothing since Phase 9A has run in Expo Go.** The project's own definition of done requires a
device check, and every phase since has been signed off on `typecheck + lint + test` alone. The
artboard-comparison half of that rule does not apply — these screens have no artboard — but the
behavioural half very much does.

What only a device can settle:

- **Keyboard.** Twelve new forms in 9F plus the section editors in 9C. `Screen keyboard` pads on
  iOS and relies on the OS resize on Android; the sticky action bar must ride above the keyboard
  and never cover the focused field. Return-key chaining (`next` → next field, `done` → submit).
- **`MonthYearSheet`** in the profile date rows — it hugs its content, and the year strip scrolls
  to the selected year on layout. Never seen at 1.3× Dynamic Type.
- **`Sheet avoidKeyboard`** on the rename pane. `useAnimatedKeyboard` is iOS-only on purpose: on
  Android it disables `adjustResize` app-wide while mounted.
- **The document picker** (`expo-document-picker`) in the upload and ATS-check flows, and
  **`expo-print` / `expo-sharing`** in the export sheet. All are lazily required and degrade to a
  toast, so a missing module will not crash — but the happy path has never run.
- **Signed-out cold start.** `Stack.Protected` + `unstable_settings.anchor = '(tabs)'` is reasoned
  about in a comment and unit-tested at the store level, but the redirect on the guard flip has
  never been seen. The fallback if it misbehaves is a root `<Redirect>`.
- **Haptics and motion.** Reduced-motion pass; Perf Monitor in `start:prod` on a mid-range Android
  for sheet open/close, chip insert/remove, and the generation ticker.
- **Artboard mode** toggled on the new screens, to catch any unscaled length literal that ESLint's
  property list does not cover.

---

## 4. Smaller things

- **Jest worker warning.** `A worker process has failed to exit gracefully` on the full run.
  `--detectOpenHandles` over the resumes suites reports nothing; it is most likely the mock
  generation ticker in the generations suite, which predates 9C. Harmless today, worth chasing
  before it hides a real leak.
- **File length.** Eight files sit at 252–302 lines against the "< 250" guideline
  (`ProfileScreen` 302 predates Phase 9). Left alone because splitting them further would be
  arithmetic rather than clarifying — but it is a guideline we are now routinely over.
- **Prettier is not in the gate.** `prettier --check` flags ~70 files, most of them predating this
  work. Either add it to `pnpm lint` and format everything once, or drop the pretence.
- **Maestro flows** cover screens up to Phase 6. 9A added `signIn.yaml` and its `runFlow` step,
  and nothing has touched `.maestro/` since. The plan asks for one step per new screen; 9B–9F
  added twenty and none is covered.
