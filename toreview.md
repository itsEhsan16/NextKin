# To review

Things that need a decision, a check on a device, or a second opinion before we call the mobile
app done. Nothing here is a bug in the sense of "the gate is red" — `pnpm typecheck && pnpm lint
&& pnpm test` is green at every commit. These are the calls that were made without you, the ones
that were deliberately deferred, and the ones only a real device can settle.

Add to this file whenever a judgement call gets made rather than burying it in a commit message.

**Status:** Phases 9A–9I shipped, and **Phase 10** — the first device-feedback pass — has landed on
top of them. No placeholder destination remains: `src/features/placeholders.ts`,
`app/placeholder/[screen].tsx` and `src/ui/Placeholder` are deleted, so a new dead link cannot be
typed. Everything undesigned is built from the spec; what is left is this file and a second device
pass over the Phase 10 changes.

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

### 1.8 The interview cap is read per resume, and its upsell names no reset date (conflict C1)

§13.3 gives Free "1 question set per generated resume". `SubscriptionUsage` models it as a flat
`interviewSetsUsed / interviewSetsLimit` pair and the fixture account is seeded **at** it (1/1),
so a `used >= limit` gate would put `/interview/new` behind an upsell the demo could never clear —
the `resumesUsed` trap of 1.1 again. `interviewAllowance()` therefore counts the sets that
**exist for the chosen resume** and gates on that; the seeded Stripe set blocks only the Stripe
resume. Standalone role-title sets have no resume to be capped per and §13.3 does not mention
them, so they share one bucket under the same per-target limit. `interviewSetsUsed` is still
bumped on every completed set and drawn on `/upgrade`, but it is **informational** — nothing gates
on it.

§13.5's upsell table asks for a **quota reset date**. There is none the app can honestly know:
this cap has no period, and the assistant's (1.9) is daily with no clock in the mock that rolls
it. `renewsAt` is the billing renewal, a different fact. Both upsells state the cap and what Pro
does instead, and a test on each pins that the word "resets" never appears.

**Decide:** whether the real API will expose a per-resume cap (then this is right as built) or
a flat monthly count (then `interviewAllowance` collapses to the flat gate and the fixture must
start below it), and whether §13.5's reset-date row should be struck for these two caps.

### 1.9 The assistant's daily counter never rolls over in the mock

`assistantMessagesUsed` (12 of 20) moves on every send — a refusal counts, per §13.3 — and the
meter says "left **today**", but nothing resets it at midnight. In a long Expo Go session the
demo account will spend its 8 remaining messages and then only see the upsell until the app's
storage is cleared. A rollover needs a date the counter was last reset, which `SubscriptionUsage`
does not carry.

**Decide:** add a `usageDay` (or a `resetsAt` per counter) to the model now, so the real API's
shape is not guessed later, or accept the mock as-is for the demo.

### 1.10 The domain lock is a keyword classifier, not a model

§7.16 specifies a model classifier plus a system prompt. `assistantDomain.ts` is a keyword and
phrase matcher with a small deny list, and its doc comment says what that cannot do: it
**over-refuses** paraphrases with none of the listed words ("what should I put at the top of the
page?") and **under-refuses** off-topic questions that happen to contain one ("how's the weather
for an *interview* in Delhi?"). The canned answers are keyed by the same topics, so an accepted
question always gets a relevant paragraph, never a wrong one. This is the right stand-in for a
mock and the wrong thing to ship against a real model.

**Decide:** nothing now — but when the API lands, the classifier and `answerFor()` are the two
files that go, and the screen should not need to change.

### 1.11 Two assistant calls that are yours

- **The transcript is a `ScrollView`, not a `FlashList`.** The plan said a static `Screen` with
  its own list and keyboard bar. A daily cap of 20 means a thread of at most ~40 bubbles a day,
  which a plain scroller handles, and `Screen keyboard scroll footer` gives the pinned composer
  the same keyboard behaviour as every other form for free. If §7.16's "persistent history"
  grows into weeks of thread, this becomes a list — the bubbles are already `memo`.
- **`AssistantRepo.clear()` exists and no screen calls it.** The rule on the screen is "no control
  mutates anything", and a Clear thread control would be the first exception. Wiring it is a
  five-line change once you decide it belongs; leaving it out was the conservative reading.

### 1.12 Control geometry now reads between the two artboards — a deliberate rule-7 deviation

**This is the one to overrule if you disagree with anything in Phase 10.**

Geometry was a single factor: every length is `width / 520`, so on a 390dp phone everything is
×0.75 and on a 360dp one ×0.69. Type stopped following that factor in an earlier round of exactly
this complaint — the design team drew a 390 board with the layout at ×0.75 and the font sizes
deliberately held back, and `typographyFor` reads between the two boards. **The boxes were never
given the same treatment**, so text grew relative to its container and the result read as cramped.
It also put every interactive control under the 44pt floor `CLAUDE.md` rule 5 requires:

| token | drawn | was @390 | was @360 | now |
|---|---|---|---|---|
| `listRow` | 58 | 43.5 | 40.2 | **52** |
| `buttonLg` | 56 | 42.0 | 38.8 | **50** |
| `buttonMd` / `searchField` / `filterButton` | 52 | 39.0 | 36.0 | **46** |
| `iconButton` / `headerButton` / `segmentedControl` | 48 | 36.0 | 33.2 | **44** |

`CONTROL_AT390` in `src/theme/scaleTheme.ts` holds the anchors. Composition is untouched — `scale`,
spacing, radii, the gutter, the tab bar, rings and tiles still answer to the single factor, which
is why `artboardFidelity.test.ts` stayed green without being edited. At 520 every control is still
its drawn size, node for node.

`ProfileScreen`'s group gap also went from the drawn 20 (15dp at 390) to 28 (21dp) — the only
per-screen deviation, and the only one on a screen that has an artboard.

**Decide:** whether a phone may diverge from the artboard for touch ergonomics. If the answer is
no, revert `CONTROL_AT390` and the Profile gap and we accept 40dp rows on a 360dp device.

### 1.13 The type ramp is still flat on a phone — the other half of 1.12

Eleven roles collapse onto **exactly 11.5pt** at 390: `caption`, `captionRegular`,
`captionSemiBold`, `jobMeta`, `rowDescription`, `overline`, `scoreSm`, `captionSm`, `pill`,
`pillStrong`, `microSemiBold`. A subtitle, a footnote and a section header are typographically
identical, which is a real part of why secondary text reads as one grey mush.

You chose geometry only for Phase 10, so this was deliberately left. Fixing it means giving those
roles distinct `at390` anchors, and it changes the look of every screen, so it wants its own device
pass.

**Decide:** whether to do it next.

### 1.14 Two versions of the same §7.8 honesty claim

`SCORE_HONESTY_NOTE` (70 words, `data/models/resume.ts`, on the rubric screen) and
`ATS_CHECK_HONESTY_NOTE` (29 words, `create/atsCheckSetup.ts`, on the ATS check screen) make the
same promise at two lengths. Both were kept — neither screen shows both, and cutting either would
be cutting a §7.8 obligation on the judgement that the other covers it.

**Decide:** whether the short one should simply be the long one, or whether two registers are right.

### 1.15 Three things from the device pass that were *not* defects

Recorded so they are not re-investigated:

- **The floating gear** overlapping the password field and the Profile tab label is **Expo Go's own
  dev-menu launcher**, drawn by the host outside the React tree. Not in this codebase, not
  repositionable from app code, absent from a real build.
- **Content under the floating tab pill** is by design — an opaque pill plus `TabBarScrim`, with
  `tabBarInset` reserving 101.6dp + safe area so the *last* row always clears. A screenshot showing
  a half-hidden row is mid-scroll.
- **The Profile screen's stats / completeness / plan cards** are implemented and rendered
  (`ProfileScreen.tsx:152-158`). The identity header is pinned, so a screenshot can be scrolled past
  them and look as though they are missing.

### 1.16b The second device pass — three defects no test could have caught, and what now catches them

You found three more on the device. All three are fixed; each one is recorded here because the fix
carries a judgement.

**1. A focused field sat under the keyboard.** `Screen keyboard` gives iOS a
`KeyboardAvoidingView` and Android its window resize. Both make the field *reachable*; neither moves
the scroll offset, and React Native's `ScrollView` does not scroll to a focused `TextInput` on
Android at all. **14 screens** were affected — every form in the app. `src/ui/Screen/revealOnFocus.tsx`
now provides a reveal through context, `TextField` asks for it on focus, and the arithmetic is a
pure `revealTarget()` with its own test. Pure JS on purpose: `react-native-keyboard-controller` is a
native module and would break Expo Go (rule 1).
**Decide:** whether `SearchField` should do the same. It is in a pinned header on all three of its
screens today, so it cannot be covered — but that is a property of those screens, not of the control.

**2. A sheet was painted under the page's own action bar.** `zIndex.sheet: 50` was in the tokens and
**never applied**, while `StickyActionBar` declares 10 — and an explicit z-index beats document
order. So the profile date picker's "Done" was half-covered by the page's "Save", and the scrim did
not dim it. One line in `Sheet.tsx`. `__tests__/ui/SheetLayering.test.tsx` now pins the order.

**3. The end date was destroyed by the "I currently work here" switch.** Not a load bug — the draft
builder was always right and a test already covered it. Toggling the switch ON patched
`{ current: true, endDate: '' }` and toggling it OFF restored only `current`, so a flick of the
switch turned "Feb 2022" into "Not set" and saving persisted the loss. The same code was in the
education form. The date is now hidden rather than cleared; `experienceEntry` already dropped it at
serialisation, so the clear was never needed.

**Why no test caught any of it, and what changed.** Jest renders without layout — no keyboard, no
z-order, no measured heights — so the first two are structurally invisible to it. The third was
invisible for a different and more interesting reason: *each half was correct on its own, and only
the sequence lost data*. `__tests__/features/profile/profileDrafts.test.ts` now tests the property
instead of the path — every entry type goes through draft → entry and must come back identical,
including across a toggle round trip — so a form added later inherits the check.

That test found a fourth thing on its first run: **both seeded profile links had no `kind`**, so they
drew the generic chain glyph instead of a palette and an ID badge, and opening one put the picker on
"Other" — a Save that changed nothing still rewrote the record. Fixture fixed.

### 1.16c The prose trim, and the seven regressions the verify pass caught

74 cuts across the Phase 9 screens, each checked by a second agent that re-read the files rather
than trusting the report. It found **seven** problems, all fixed before the gate:

- **Two rule-7 breaks.** `ResumeScoreScreen`'s "Green checks appear the moment a fix lands" and
  `ResumesFirstRun`'s "most people are done in under ten minutes" are **drawn on the artboards**
  (1:2109 and 1:2061 — the verifier opened the PNGs). Both reverted, with their test assertions.
  §1.12's claim that the Profile group gap is the only artboard deviation therefore still holds.
- **A §7.10 limit deleted.** The cover-letter screen's "written from a resume and the job it was
  tailored to" was cut on the reasoning that the title carries it. The title is an instruction, not
  the rule, and that branch fires with a library *full* of resumes — so the screen read as broken.
  Restored, shortened.
- **A layout change disguised as a copy change.** Dropping the Full name helper stopped `TextField`
  reserving its helper row, so the first validation error would shove the rest of the form down a
  line and the skeleton would over-draw. Restored as "Required.", which also marks the form's two
  required inputs the same way.
- **An irreversible action left undisclosed.** Removing "Saves as soon as you pick it" left the
  discard sheet's "leaves your profile exactly as it was" false, because the avatar writes on pick.
- **A §7.9 obligation.** `EntryCard` lost the only text saying how to clear a review flag, while the
  download gate still requires it be cleared.
- **A Pro-plan note** removed on the strength of a state the data layer cannot produce.

**Changes of mine the verifier flagged as undeclared, kept deliberately:** removing the duplicate
"Message support instead" from Help's no-results state (the "Still stuck?" card is on screen in that
same branch), the duplicate Add CTAs on the four entry lists and Interview prep, and renaming
`FILE_CTA` to "Check a file from your device" (its only branch has nothing to do it *instead* of).

**Not acted on — overrule if you disagree:** §7.4's "nothing reaches your profile until you say so"
now appears once, on the review screen rather than before the file is picked; `LinkFormScreen`'s
delete confirm no longer mentions generated documents while its three siblings do;
`ResumeEditorScreen`'s two error branches are now worded identically; and `DataExportState`'s
skeleton block is measured for a body that got shorter.

### 1.16 One same-destination pair kept on purpose

`NotificationsScreen` reaches preferences twice: the header cog (`:128`) and a "Manage notification
types" row at the end of the feed (`:221`). Left alone — different labels, different affordances,
different moments (before reading vs after), and the header is artboard chrome. Every *identical*
duplicate was removed.

**Decide:** overrule if you want strictly one route per destination per screen.

---

## 2. Gaps in the plan itself

These are things the approved plan does not schedule anywhere. Each needs a home before we can
say Phase 9 is complete.

| Gap | Detail | Suggested home |
|---|---|---|
| ~~`resume-sort`~~ | **Built in 9I** (`ResumeSortSheetHost`, sorted in `useResumes(sort)`'s `select` so every other reader of the list is untouched). Kept here so the row's history is not lost. | done |
| Version history | `useRestoreVersion` and `useResumeVersions` exist and work; **nothing consumes them**. The editor shows "v3" with no way to see or restore the other two, and §7.11 requires append-only history to be visible. `useGenerations` was deleted in 9I (History reads activity entries, not runs), so the version hooks are now the only orphans in `@/data/queries`. | needs a phase |
| Rewrite a letter in another tone | 9D built the tone picker for a *new* letter. The editor's `LetterBody` deliberately has none, because regenerating spends a cover-letter generation and §13.5 wants the cap on screen first. So an existing letter cannot be rewritten in another tone at all. | needs a phase |
| Zero Resume cap | §13.3 publishes "Zero Resume drafts: 1/month on Free" as its own row. `SubscriptionUsage` has no counter for it, so `/create/zero-resume` meters against the generations quota instead. | data-layer change |
| Saved-jobs cap | §13.3 says "Up to 10" on Free. Home's fixture ships 18 saved jobs and the job fixtures 12; both predate the cap and neither is enforced. | fixtures + 9H |
| Saved-jobs sort is client-side | `listSaved(sort?)` on the repo can order the list, but `useSavedJobs()` takes no argument and query hooks were off limits during the 9H build, so the Saved tab sorts in the screen. Harmless at 12 rows; wrong the moment the list is paged. | a query-layer change |

---

## 3. Device verification

**Phase 9 finally ran in Expo Go, and it found four real defects** — a Yoga starvation bug that was
rendering row titles at zero width, controls under the 44pt floor, duplicated actions, and 5–6× the
prose of the designed screens. All four are fixed in Phase 10. That is the argument for this rule,
made in one session: `typecheck + lint + test` was green through all of it.

**Phase 10's own changes have not been on a device yet**, and they are geometry changes, so they
need one:
- every screen at 360dp and at 430dp — the control anchors are a *floor* below 390, so the smallest
  phones changed the most;
- the segmented control's pill, which now derives its inset from the two heights rather than a
  drawn 4pt — check it is centred in its track on Jobs, Practice and the new-set screen;
- the four profile lists at 1.3× Dynamic Type, where a two-line row plus a tag line is tallest;
- Profile itself against the PROFILE 01/02 artboard, to confirm only the group gap moved.

What still needs a device from the earlier phases:

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
- **9I specifically — the worst phase to skip.** A reply streaming into the transcript while the
  keyboard is up (does the composer stay above it, does the list keep its place?); the Home menu
  sheet over the tab bar (scrim dims the pill and FAB, Android back closes it); the interview
  practice card's reveal at 1.3× Dynamic Type; and the full walk — Home menu → each row; History →
  filter, tap a row, land on the right screen; Interview → new set → run → practice → mark → leave
  → return and the marks are still there; Assistant → suggested prompt → streaming reply →
  off-domain refusal → meter at 0 → upsell.

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
