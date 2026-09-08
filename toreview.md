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

On top of those, the **onboarding and sign-up flow** (Figma 290:955) and the **app icon** have
landed — the first designed auth screens in the app, and the first time a fresh install does not
open on the tabs. Section 6 holds the calls that came with them; none of it has been on a device.

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

### 1.16d Third device pass — and the reason the 44pt fix did not reach everywhere

Two more, both fixed.

**A sheet opened on top of a live keyboard.** Tapping a date row straight from a focused "Job
title" opened the picker *and* left the keyboard up, and the OS draws the keyboard above everything
in the React tree — so no z-index could have saved it. `Sheet` now dismisses the keyboard as it
opens, unless it declares `avoidKeyboard` (the rename pane and the location sheet raise their own,
and dismissing would fight their autofocus).

**The notification row menu was still cramped, because it never used the tokens.** `RowMenuSheetBody`
declared its own `const ROW_HEIGHT = 56`, which takes the flat scale factor and lands at **42dp** —
under the floor, and untouched by `CONTROL_AT390`. Its label and caption also sat at `gap: 0`.

That is the general lesson, and it is worth stating plainly: **the 44pt floor is only enforced on
tokens, and a local constant silently opts out of it.** A sweep found three tappable rows doing this
— `RowMenuSheetBody` (42dp), `ResumeMenuSheetBody` (42dp) and Profile's Sign out (43.5dp) — all now
on `sizes.listRow`. Everything else the sweep turned up is a skeleton block or a non-tappable row,
or already pads itself with `hitSlopFor`.

**Decide / worth doing next:** there is no automated guard for this. The scaled-theme test asserts
the *tokens* clear 44pt, but nothing stops a component hard-coding a height. An ESLint rule in the
shape of the existing unscaled-literal one — flag `minHeight: s(<number>)` inside a `Pressable` —
would close it. Until then the grep is `ROW_HEIGHT\s*=|minHeight: s\(`.

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

---

## 5. The test APK

### 5.1 An internal-distribution APK against the "Expo Go only" rule

Hard rule 1 says Expo Go only. `apps/mobile/eas.json` now adds a `preview` profile that produces
a standalone Android APK, and that is a deliberate reading of the rule rather than a break of it:
the rule constrains *dependencies* ("every dependency must run inside Expo Go SDK 57 … no
`expo-dev-client`, no `react-native-mmkv`"), and nothing about the APK changes that set. No
dependency was added, no config plugin, no dev client — the same JS bundle and the same
Expo-Go-compatible native modules, packaged for people who cannot or will not install Expo Go and
scan a QR. If the rule was meant to forbid standalone builds outright, this is the thing to
overrule.

### 5.2 The APK is a release build, so three dev affordances are gone

`preview` builds with `__DEV__` false. That silently removes three things the Expo Go workflow has:

- **The dev gallery** (`app/dev`) — guarded by `<Stack.Protected guard={__DEV__}>`.
- **The Figma overlay** — the 25 artboard PNGs resolve to `figmaRefs.stub.ts` in a non-dev bundle.
- **The mock-mode switch** — `readPersistedMode()` returns `'normal'` unconditionally when
  `__DEV__` is false, so an APK tester cannot exercise the slow / empty / error states. Every
  screen's other three states are therefore **unreachable on the APK**; they stay verifiable only
  in Expo Go. If device-testing the empty and error states matters, that switch needs a
  non-`__DEV__` trigger (a hidden gesture, or an `extra` flag read from the build profile) —
  which is a change to make deliberately, not a side effect of shipping an APK.

### 5.3 The EAS link, and the account it points at

`app.config.ts` now carries `owner: 'nextkin-edu'` and
`extra.eas.projectId: '3573538a-72e7-4602-8167-8ffee307795e'`, pasted by hand because the dynamic
config stops eas-cli writing them. `eas project:info` resolves to `@nextkin-edu/nextkin`.

**The account is a judgement call, not a given.** The signed-in user `nextkin` owns two accounts —
a personal `nextkin` (no apps) and an organisation `nextkin-edu`. The project issued by the
dashboard lives in `nextkin-edu`, so `owner` follows it there. That choice decides who is billed
for EAS builds, who can be granted access, and whose name appears as `@nextkin-edu/nextkin` in
build URLs and internal-distribution links. If the app was meant to sit under the personal
account, the fix is a new project on that account and a new id here — not an edit to `owner`
alone.

### 5.4 Not decided yet

- **Versioning.** `cli.appVersionSource` is `remote`, so EAS owns `versionCode` and the repo owns
  the user-facing `version` (`0.1.0`). Nothing increments `version` yet.
- **No `expo-updates`.** Every change needs a fresh APK; there is no OTA channel and the profiles
  deliberately declare none.
- **Signing.** The first build will offer to generate an Android keystore on EAS. Accepting means
  Expo holds the signing key. Fine for internal testing, a decision to revisit before any store
  submission.

---

## 6. Onboarding, sign-up and the app icon (Figma 290:955)

### 6.1 A third artboard width, and why the whole flow is normalised onto one

Every length in the app reaches the screen through `theme.s(px)`, which reads its input as a
measurement off the 520 "Mobile App" board. The six onboarding and auth sections are drawn at
**422.66** — and the first two (welcome, slide 1) at **414.67**. These are phone-sized frames,
not presentation frames, so their numbers are ~1.23x smaller than the same element at 520;
passing them to `s()` raw would render the flow a quarter too small.

`src/features/auth/board.ts` converts a drawn length into 520-space, and `authRole` in
`src/theme/typography.ts` does the same for font size, so every number in the new screens stays
traceable to its Figma node. **The 414.67 sections are normalised onto 422.66 rather than kept
apart**: their layout numbers (left 43, top 109, the bottom bar) are identical to slides 2 and 3,
so the 1.9% is frame drift rather than intent, and two slides of a carousel scaling differently
from the third would be a worse bug than the 1.9%. The Figma overlay in the dev gallery keeps
each artboard's true width, so it will show that 1.9% on those two screens — that is the
normalisation, not a layout error.

### 6.2 The type ramp gained a third category

`typeRamp.test.ts` judged every role against the Mobile 2 compression curve, with an exemption
list. These roles were drawn on one board and have both anchors projected from it, so they sit on
the flat geometry line instead — the same claim the Home `drawnAt390` roles make. Rather than
adding 17 entries to the exemption list, they carry a `singleBoard` marker and are checked on
their own terms. The Home re-measure guard still counts only Home.

### 6.3 DM Sans and Montserrat map onto Plus Jakarta Sans (weights kept)

Decided with the user: the board sets almost everything in DM Sans and the welcome screen's
letter-spaced caps in Montserrat, and neither is loaded. Adding two `@expo-google-fonts` packages
would put two more families in the startup gate that holds the splash, so both map onto Plus
Jakarta Sans instead. **The new screens will not match the artboards on letterform** — most
visibly the two Montserrat tagline lines, where tracking does a lot of the work. Inter *is*
loaded (700 only), so `authHero` and `authTitle`, which the board itself sets in Inter Bold, keep
it.

**The weights are the board's, not the family's.** The first pass read `font-['DM_Sans:Regular']`
out of the extracted CSS as "regular" and set every heading, the step counter and the feature
titles to it; the board renders all of them **bold**, and on a device the whole flow came out
looking thin and wrong. Weight is now taken from what the artboards draw: bold for the two
wordmarks, the slide headings, the "n" of the step counter and the feature titles; semibold for
"Get Started", the job-card titles and the "Sign in" half of the sign-up footer; regular for the
lead copy, the "/ 3" and the field placeholders.

### 6.4 The welcome screen advances itself

290:957 draws no control at all. It is treated as a held brand moment: a ~1.6s hold, then
`router.replace` to the slides, with a tap anywhere taking it early. Reduced motion removes the
fade but **not** the advance — stranding a reader on a screen with nothing to press would be
worse than the motion. If it is meant to be a splash rather than a screen, it should move into
`expo-splash-screen` config and stop being a route.

### 6.5 Sign-up validates presence and nothing else

Per the user: any name, any address, any password signs you in. `authForms.ts` therefore checks
only that each field is non-blank — no email-shape rule, deliberately, so throwaway values work.
`looksLikeEmail` already exists in `accountForms.ts` and is waiting for §7.1 to gain a server.

**The entered name and email are discarded.** `sessionStore.signIn()` takes no arguments and the
store holds a status and no user, so nothing carries the new account's identity into the app —
Profile still shows the pre-seeded mock person. Giving the session a user model is a real change
and was not made here.

### 6.6 There is no Sign in screen; both affordances point at the old stub

The node has six artboards and none of them is a sign-in form, yet the landing has a "Sign in"
button and sign-up has an "Already have an account? Sign in" link. The user is providing that
design, so nothing was invented: both route to the existing design-gated `SignInScreen`, which
still says it is design-gated and still signs you into the mock account. It looks nothing like
the flow it is reached from. Replace it wholesale when the artboard lands.

Also absent from the board: **Apple sign-in and forgot-password**, both of which V2 §7.1
requires (Apple is mandatory on iOS once any other social login ships). The screen was built from
the artboard, so neither is there.

### 6.7 `AuthField` duplicates part of `TextField`

The board's fields are outlined, 16-radius, with a leading glyph and the label carried by the
placeholder — a different control from the filled `src/ui/TextField`, which is the app's text
primitive. Bending the primitive into a second shape for one screen looked worse than building
the field against its artboard, so `AuthField` is a feature-level component.

**That call has already cost something, and the argument for reversing it is now stronger than
the one for making it.** A parallel control does not inherit the app's cross-cutting text-entry
behaviour — it has to opt into each piece by hand, and anything forgotten fails silently. The
reveal-on-focus scroll was forgotten, and the second device pass found the email and password
boxes sitting under the keyboard (6.14). What it still does not have is TextField's one-shot
accessibility announcement on a new error and its haptic warning; the error-swap row is
re-implemented rather than shared.

Fold the two together as a TextField variant when auth gains its second designed form — or
sooner, since the sign-in artboard is already coming.

### 6.8 Icons come from the board, not from FontAwesome

Originally the three slide-3 glyphs and the four sign-up field icons were FontAwesome
metaphors — paper plane, bar chart, bell; user, envelope, lock, eye — on the reasoning that
70-odd files already take their icons from that set. **That was wrong and the device pass showed
it.** The board's glyphs are two-tone (dark ink over a pale mint or lavender shape) and its field
icons are thin strokes in a muted grey; a single-colour FontAwesome solid cannot be tinted into
either. All seven are now the board's own vectors, in `assets/icons/onboarding/`.

Two notes on how they were obtained, because a Figma export will not give them directly: the
export of any node carries its ancestors' backgrounds (see 6.11), so each icon was lifted out of
its export by extracting the named `<g>` subtree, whose coordinates are already local to the
node's own viewBox. The paper plane has no group of its own, so its two vectors are composed at
their measured offsets the way the brand mark is.

`field-reveal-on.svg` is derived rather than exported: the board draws only the struck-through
eye (the masked state), so the revealed state is the same icon with the strike path removed. The
struck-through eye is the *masked* state, which is the board's own default — the opposite of the
convention some apps use.

The three big illustrations and the Notion and Spotify marks are committed SVGs too, because
nothing stands in for those.

Every one of these assets carries its own hardcoded fill, as the repo's other 23 SVGs do, so
they do not respond to `color` and stay the same in dark mode.

### 6.9 The board is drawn light-only

Every new colour role is defined in both schemes because the token type demands it, but only the
light values are drawn. The brand gradient is kept identical in dark (it is a brand surface); the
neutral surfaces, text and borders map onto existing dark roles. **Nothing in dark mode here has
been looked at against a design**, because there is not one.

### 6.10 The first-run flip, and what it did not break

`sessionStore` now defaults to `signed_out` instead of `signed_in`, which is what puts the
welcome screen in front of a fresh install. The blast radius was three assertions in
`sessionStore.test.ts` and README rule 10; the other 158 suites render screens directly rather
than through the gate and did not move. `.maestro/signIn.yaml` was rewritten to walk the new path
(welcome, Skip, landing, account form), each step conditional so it still works on a device that
has been through onboarding already — **but no Maestro flow has been run**, on this change or any
other, so all six are unverified.

### 6.11 The icons are generated from the repo's own SVGs, not from Figma

The user chose "render the mark from Figma" over adding `sharp`. Both Figma paths failed on their
own terms:

- `get_screenshot` will not render *above* a node's natural size, so the 101x105 logo mark came
  back at 101x105.
- `download_assets` at 4x gave 404x420 — and **opaque**, with the welcome screen's purple
  gradient baked in, because a Figma export carries its ancestors' backgrounds. (The same trap
  caught the illustration exports, which arrived with a `#1E1E1E` canvas rect behind them; those
  are taken from `svgAssets` instead, which is isolated.)

So `scripts/generate-icons.cjs` composes `assets/brand/mark-{1,2,3}.svg` — already in the repo,
and the same three layers `src/ui/BrandMark` draws — into one SVG and rasterises it. **This is
still not `sharp` as a dependency**: it is a one-off `npx sharp-cli` whose output is committed as
`assets/brand/mark-1024.png`, and the script falls back to that committed PNG when npx is
unavailable, so only a change to the mark itself needs the network. `jimp-compact` *was* added,
as a root devDependency — pure JavaScript, no native binary, build-time only, never in the app
bundle. That is a reading of hard rule 1 as constraining what runs inside Expo Go, the same
reading 5.1 used for the APK. If the rule was meant to cover every dependency, overrule it.

`icon.png` and the adaptive background are written as RGB with no alpha (iOS rejects an icon
carrying one); the adaptive foreground sits at 55% of the canvas, inside Android's 66% safe
circle. The adaptive layers went from the scaffold's 512 to 1024, and monochrome from 432.

### 6.12 The first device pass, and the three defects it found

Onboarding slides 1 and 3 were run in Expo Go. Every one of the three was invisible to the test
suite, which is the same lesson section 3 records.

- **Every heading was the wrong weight** — see 6.3. Regular where the board draws bold, across
  the whole flow. A test that asserts a role exists cannot see that it is too light.
- **Slide 3's feature rows rendered as empty boxes.** `FeatureRows` had no width of its own and
  the slide centres its illustration slot, so the cards shrank to their content, the copy
  column's `flex: 1` resolved to zero, and all six lines of text vanished. The suite passed
  throughout: `getByLabelText` found the rows by the accessibility label built from the same
  strings, which exists whether or not the `<Text>` has room to draw. Now pinned by
  `alignSelf: stretch` and a comment saying why.
- **Type ran ~7% oversized and wrapped.** The auth roles were not `cellBound`, so below 390dp
  they held flat while their column kept shrinking — the exact trap `cellRole` was written for.
  On a 369dp phone "step with confidence." took a third line the board fits in two.
  `typeRamp.test.ts` now asserts the equality (not just a floor) at six widths from 320 to 430.

Also corrected from the same screenshots: the feature glyphs were tinted brand-purple where the
board draws them two-tone dark (6.8).

### 6.13 The second device pass — three more, two of them cross-cutting

Slides 1 and 3 came back clean. The sign-up screen and the auth landing did not.

- **Text was clipped on every tight-leading role** — the tops cut off "you ahead.", "Sign in"
  and "Continue with Google". The board sets leading as low as 1.0x the font size (both
  wordmarks, the step counter) and 1.02 on the hero, which is fine for the DM Sans and Inter it
  was drawn in. Plus Jakarta Sans, which those map onto (6.3), needs **1.26 em** by its own
  ascent, descent and line gap — and React Native clips a glyph that will not fit the line box
  rather than growing it. `authRole` now floors leading at 1.3 em.

  On single-line roles that costs nothing. **On the two-line headings the leading is looser than
  drawn**, which is a visible deviation from the board and a direct consequence of the family
  swap, not a choice. If the tight leading matters more than the substitution,
  `@expo-google-fonts/dm-sans` is the way back.

  `__tests__/theme/authLeading.test.ts` checks every role against the shipped TTF rather than
  against the 1.3 constant, so changing family fails loudly instead of clipping quietly.

- **The keyboard covered the email and password boxes.** `AuthField` never called
  `useRevealOnFocus`, so the page was never asked to scroll a focused field clear. The reason it
  went unnoticed is the reason 6.7 is now marked for reversal: the hook is a context opt-in, so a
  control that forgets it is silently inert while every test stays green. Wired now, and
  `SignUpScreen.test.tsx` asserts each field carries an `onFocus`.

- **The Google button ended its scroll half-cut against the footer.** Treated at the time as a
  padding shortfall and "fixed" by raising the bottom padding from 24 to 40 board px. That was a
  workaround for the wrong cause, and 6.15 replaces it.

### 6.15 The third device pass — the double inset, and why the footer was ever pinned

The real cause of the crowding at the bottom of sign-up, which the second pass mis-read as a
padding shortfall.

**The artboards budget the whole screen.** Summed down 296:3032, the drawn offsets account for
all 895 of the frame — 97 of head room, three fields, the two buttons, and a 44.47 floor, landing
on 894.9. The status bar and the gesture area are inside that, and the padding at each end is the
allowance for them. Every screen was rendering with `<Screen edges={['top', 'bottom']}>`, which
adds the device insets *on top of* an allowance that already existed: roughly 80dp of space in
neither the design nor the device. On a 412dp phone the board is 872dp tall against about 892dp
of screen — it fits, with room to spare, and only stopped fitting because of the insets.

Two consequences, both now undone:

- **The footer never needed pinning.** It was pinned because the page had been made too tall for
  its own content; it now flows with the page, 34.14 below the Google button, where the board
  puts it.
- **The gap above "Create an account" was 19.23 instead of 92.41.** The heading was jammed under
  the wordmark, and the back chevron — which the board places *beside* the lock-up at y=78, not
  above it — was stacked in the flow, pushing the whole page down by its 48pt tap target. It is
  now taken out of the flow and positioned, with the target still a full 48 centred on the 23.5
  glyph the board draws.

All four screens now take `edges={[]}`. Where the board's own allowance is thinner than the inset
it was drawn against — the slides give "Skip" only 41, which a deep notch would swallow — the
larger of the two wins. `AUTH_FRAME_HEIGHT` in `src/features/auth/board.ts` carries the rule.

**This one is worth generalising.** It is not an onboarding quirk: any artboard that draws a full
device screen has the same trap, and the 25 older boards are 1440 and 1720 tall against a 520
width, so they are *not* full screens and genuinely do need their edges. The two conventions now
coexist in the codebase with nothing marking which is which beyond this note.

### 6.16 The board was revised mid-build, and I was measuring a stale copy

The single biggest source of error in this whole flow, and it went unnoticed for three rounds.

Every measurement here was read out of Figma once, at the start. **296:3032 was then revised**,
and the build kept quoting the old numbers:

| | read at the start | current |
|---|---|---|
| Section top | 269.35 | **197** |
| Back chevron | y=78.11 | **y=52.11** |
| Footer | y=832.53 | **y=747** |
| Floor below footer | 44.47 | **130** |
| Primary CTA | `#B9EF30` lime | **`#9890F8` violet** |

The gap above "Create an account" is the clearest casualty. It should be 20.06 — the section now
starts at 197, just under the lock-up's 196.17. Reading it off the old 269.35 gives **92.41**, and
in the third pass I "corrected" 19.23 (near enough right by luck) *to* 92.41, making the screen
markedly worse and then pinning the footer to cope with the height it added. Two rounds of fixes
were spent on a problem the board had already solved.

Re-checked against the current file, the other five sections are unchanged except slide 3's
bottom bar, which moved 3.6 (790.6 to 787), and the auth landing's gradient button, which is as
drawn. Those are corrected too.

**What now stops it happening again.** `src/features/auth/signUpLayout.ts` holds every drawn
measurement for that screen in one object, the screen and `AuthField` both read from it, and
`__tests__/features/auth/signUpLayout.test.ts` asserts the vertical pieces still account for the
frame's 895. A gap measured against a stale revision pushes the sum off and fails there — the
92.41 error puts it 72 out, and the test says so by name. The other five sections have no such
sum; they are worth giving one.

The habit that would have caught it earlier is simpler: **re-read the node before measuring
against it**, not once per session.

### 6.14 Still not verified

- **The welcome screen and slide 2 have not been seen at all.** Slides 1 and 3, the landing and
  sign-up have. The welcome screen is the one with the self-advancing timer and the gradient, and
  slide 2 the one with three rotated cards — both the kind of thing the two passes so far have
  found defects in.
- **None of the second- or third-pass fixes have been re-checked on a device.** The leading
  floor, the keyboard reveal, the dropped insets, the unpinned footer and the restored 92.41 gap
  are all argued from the metrics and the board's own arithmetic, and all are green in the suite
  — but the suite was green through all three passes, which is the whole point.
- **Only sign-up has a budget test.** `signUpLayout.test.ts` guards that screen's arithmetic;
  the welcome screen, the three slides and the landing still carry their measurements inline with
  nothing summing them. Nothing asserts that these screens ask for no safe-area edges, either.
- **The CTA colour token was renamed** `ctaLime` to `ctaPrimary` when the board changed it to
  violet. If the lime returns, the token name is right but `palette.violet400` is not.
- **The launcher icon cannot be seen in Expo Go at all** — it shows Expo's own. It needs
  `eas build --profile preview`.
- **The gradient angle** on the welcome wash is the CSS 125.43deg resolved against the artboard's
  own 414.67x895 box and expressed as fractions. On a device with a different aspect it will bend
  slightly, exactly as the CSS would.
- **`react-native-svg` renders the three illustrations and the seven extracted icons**; the
  icons were seen on slide 3, the illustrations only on slide 1.
- **The extracted icons were lifted out of their exports by string surgery** on the `<g>` tree,
  not by an exporter. They render, but nothing checks that a re-export would produce the same
  subtree names, so re-running that extraction after a Figma change needs an eye on it.
