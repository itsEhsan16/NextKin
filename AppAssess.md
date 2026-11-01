# NextKin mobile app: assessment

**Date:** 2026-10-31. **Scope:** `apps/mobile`, plus the shared data layer and the backend where the app depends on them.

**Evidence:** I read the code, the V2 spec and `toreview.md`, and ran the mobile typecheck, tests and lint. I did not run the app on a phone. Everything said below about look and feel comes from code and the review log, not from using the app.

---

## 1. The verdict

**NextKin mobile is a well-built, near-complete prototype. It is not yet a product a real user can rely on.**

The screens, flows and code quality are ahead of most apps at this stage. The gap is in everything behind the screens: the app has barely been proven against the real backend, a production build cannot currently run on that backend at all, and none of the store or live-operations work has started.

The next step is therefore not more screens. It is to get the existing app working for real, on real phones, with real resumes and real jobs, and then to make the "AI that will not lie on your resume" promise visible on mobile.

| Area | Score /10 | Why |
|---|---|---|
| Feature coverage | 8.5 | 60 product routes cover nearly all of the candidate side of the spec |
| Code quality | 8 | Strict types, 1,881 passing tests, clear boundaries; some oversized screens |
| Flow and UX | 6.5 | The core loop is complete, but there are too many entry points and a slow first run |
| Trust features (the USP) | 4 | The rubric and accuracy check exist; the evidence behind them is hidden |
| Works on real data | 3 | Wired in code, not proven on a device; several parts are still mock |
| Operations (crashes, analytics, updates) | 1 | None of it exists on the client |
| Store readiness | 1 | No accounts, no Apple sign-in, no working production configuration |

The scores are my judgement, not measurements. Treat them as a ranking of where the risk sits.

---

## 2. Current status

### What was measured

| Check | Result |
|---|---|
| Typecheck | Passes |
| Tests | 1,881 passing across 211 suites. Jest warned that a worker had to be force-exited (a leaking test or timer) |
| `expo lint` (what CI runs) | Passes, and catches a planted violation. It only covers `src/` and `app/` |
| ESLint on the whole app | 14 errors, 2 warnings, all in `scripts/` and `__tests__/`, which `expo lint` skipped. Fixed in Step 0, and both folders are now in the lint script |
| Size | About 63,700 lines; 16 feature areas |
| Files over the 250-line rule | 38. The worst is `JobsScreen.tsx` at 554 lines; tokens and generated files inflate the count |
| Stray hex colours outside the theme | 1 real case (`GetStartedScreen.tsx:25`); the other hits are comments |
| Uncommitted work | **281 changed files in `apps/mobile`** on `main` |

### Where the app sits

- **Default data:** with no settings, the app runs entirely on mock data. Any email and password signs you in.
- **Backend link:** an HTTP layer exists for 10 repositories and can be switched on with `EXPO_PUBLIC_DATA_SOURCE=http`.
- **Backend proof:** the basic device test (sign up in Expo Go, confirm the email code, profile edits survive a restart) is still recorded as not proved (`toreview.md` P5-08). Tailored runs on the backend are also marked unverified on a device.
- **Screen checks:** `toreview.md` has 74 "not verified" or similar notes across the project and 92 open "Decide" items. The Build flow has not been compared side by side with its boards since §74.
- **UI pass:** §140 stopped at Profile as a sample. Phase 3 (the rollout to all other areas and the tab bar) is waiting on your phone check, so the app currently has one polished area and the rest partly updated.

---

## 3. The flow

### How a user moves through the app today

`Welcome → Onboarding → Sign up → Home → (Build or Tailor) → Job → Resume source → Generation → Ready → Accuracy check → Export → Applied`

The pieces are all there and connected. What works well:

- Every signed-in route is explicitly guarded, so a deep link cannot land on top of sign-in.
- Exports pass through an accuracy confirmation, which is rare in this category.
- Unsaved-changes protection now catches swipe-back and Android back on the profile forms.
- One error boundary now catches screen crashes.

### Where the flow is weak

1. **Too many ways to start.** Home's Build, the + sheet's Tailor, Job Detail, a copied link, Upload and ATS Check all begin in slightly different places, and Build has its own resume source picker. §139 already asks whether two job flows are really wanted. A user should not need to learn the difference between Build and Tailor.
2. **No fast first result.** The spec's target is a first resume within 15 minutes for at least 55% of signups. Nothing yet takes a new user from upload to one tailored resume with minimal confirmation.
3. **Failed runs can vanish.** Removing the Home progress card (§141) removed the only Home route back to a failed run. It also departs from spec §7.2, which requires live status on the dashboard.
4. **Mobile has fallen behind web on the best flow.** The web now has the JD page and the "path to 8.5" plan (§129). Mobile still uses its older path.
5. **No return loop.** Push is only a permission prompt: nothing registers a device with the server. Application tracking is not saved to the server either. So the app gives people little reason to come back, and the week-4 retention target of 20% depends on exactly that.
6. **Not built for phone moments.** Mobile's real advantage is catching a job the moment you see it. You can't yet share a posting from LinkedIn or a browser into NextKin, and links can't be read at all (see blocker 3).

---

## 4. Quality

### Strong

- **Architecture.** Data goes through one query layer, screens stay thin, and web and mobile share the data layer.
- **Consistency.** Theme tokens and motion tokens are followed closely. `useReducedMotion` appears in 83 files.
- **Accessibility groundwork.** The app has a shared `Pressable`, roles and labels on most controls, and error announcements.
- **Failure discipline.** The crash that cost several days (§138.7) was traced to its real cause, and a test now guards against it.

### Needs attention

- **Tests can't see the real app.** They run against mocks, and worklets run as plain JS, which is why they missed that crash. There are six Maestro flows, and they run on mock data in Expo Go.
- **Offline.** `apps/mobile` and the shared package contain no network-state handling or saved query cache. Nothing shows the last resume without a connection.
- **Large screens.** `JobsScreen.tsx`, `AssistantScreen.tsx`, `GenerationScreen.tsx` and others exceed the size rule.
- **Possible state gaps.** The Certifications, Education, Experience and Links list screens showed no loading state in a pattern search. They may inherit it from elsewhere; check before treating this as a defect.
- **Screen-reader and large-text testing.** There is no record of a full TalkBack or VoiceOver pass. Only 11 places in `src/` set a font-scale cap, so large system text is also untested.
- **Release-only behaviour.** Every state check so far ran in development mode. A release build disables the mock-mode switch, so empty and error states can't be exercised there.

---

## 5. Readiness blockers

### Must fix before anyone outside the team uses it

| # | Blocker | Evidence | Why it matters |
|---|---|---|---|
| 1 | **A production build on the backend will crash at launch** | `createRepos` refuses mock fallbacks in production. Mobile's `configureRepos` call passes no allowed list, and `notifications.list` and others are still fallbacks. It runs at module level in `AppProviders.tsx`, outside the error boundary. An existing test confirms the throw; I traced the crash path by reading the code and did not run a release build | Expo Go never hits this because `__DEV__` is true, so it would first appear in a real build **Fixed in Step 1.** |
| 2 | **A release build today would be all mock** | `eas.json` sets no `EXPO_PUBLIC_*` values, and there is no `.env` in `apps/mobile` | A tester could sign in with anything and see invented jobs and scores **Fixed in Step 1.** |
| 3 | **A copied link can produce an invented job** | `CopiedLinkHost.tsx` calls `readLink`, which stays on the mock even on the backend. The link reader was never built (§110, §114). `JobIntake` has the right guard message, but this path does not | This is the one thing the brand promises never to do. It must be blocked or built **Fixed in Step 1.** |
| 4 | **Notifications are fake on the backend** | `notifications.list`, `markRead`, `markAllRead` and `remove` are all mock | Users would see made-up alerts **Fixed in Step 1.** |
| 5 | **Applications are lost** | `apply`, `listApplications` and `updateApplicationStatus` stay on an in-memory mock by decision D-05, but the UI shows them as real | "Applied" disappears, with no warning. Either back it with the server or hide it **Fixed in Step 1.** |
| 6 | **Google sign-in isn't connected** | Mobile shows "isn't connected in this build yet" | The button is on the main sign-in screens |
| 7 | **No Apple sign-in** | Only Google is drawn, while spec §7.1 requires both | An App Store app offering Google sign-in generally has to offer an equivalent such as Sign in with Apple |
| 8 | **Domain mismatch** | Billing, Terms, Privacy and share links use `nextkin.app`; the domain bought is `nextkin.ai` (§133) | Billing and legal links may go nowhere. Check who owns `nextkin.app` **Fixed in Step 1.** |

### Must fix before the stores

- **Store accounts:** the Apple Developer and Google Play accounts and the first reviews are all "not started" in `doc/lead-time-tracker.md`. The D-U-N-S number is ready, so both can be filed now as an organization.
- **Payments rule check:** Pro is bought in a browser (D-18). Selling digital subscriptions outside store billing is restricted and the rules vary by country, so get this checked for the US, Germany and Australia. Do it before a store rejection does it for you.
- **Store paperwork:** Privacy details, the Data safety form, review demo accounts, legal review and the listing itself.
- **Release basics:** there is no crash reporting, analytics or over-the-air updates. The version is `0.1.0`, and the signing key decision is open.
- **The Expo Go-only rule:** it blocks parts of a real release. Remote push doesn't work in Expo Go on Android, and sharing into the app and universal links need native setup. Keep Expo Go for daily screen work, but allow a proper development build for the release track.

### What the product itself still lacks

These are the items from `WhyNextKin.md` §5 that remain open:

- **Real jobs:** job providers (D-12) are undecided, so listings are still fixtures.
- **Real resumes:** quality has mostly been tested on synthetic resumes.
- **The timeline engine:** it stays flag-only until a curator approves the knowledge base. This is the headline USP.
- **Live quality numbers:** none of the spec's KPIs has a mobile measurement behind it.

---

## 6. What "best app for its purpose" means

The app is being built to be **the trusted application engine for serious candidates**. Being the best here doesn't mean having the most features. It means three things competitors don't do together:

1. **It never lies.** Every claim can be traced, and users can see that.
2. **It is fast at the moment that matters.** See a job, get a truthful tailored resume, send it, from your phone.
3. **It stays honest about the odds.** It shows the real fit, the real gaps and the real basis of every number.

Today the engine can do much of this, but the user can't see it. So I would lead with visible honesty rather than new features.

---

## 7. Recommended plan

The durations are rough estimates for one focused developer. External approvals are extra.

### Step 0: Stabilize (2–3 days)

1. Commit the 281 changed files in small groups. That much uncommitted work on `main` is the biggest avoidable risk here, especially with several sessions running at once.
2. Fix the ESLint errors in `scripts/` and `__tests__/`, and add both folders to the lint script.
3. Do your phone check of the §140 Profile sample, then run Phase 3 across the remaining areas.
4. Answer the decisions in section 8.

**Done when:** all checks are green and the working tree is clean.

### Step 1: Make it real (2–3 weeks)

**Status, 2026-11-01: the code is done, and the rest needs you.** It's on branch `step-1/make-it-real`.

Done:

1. Notifications are real, and a failed run always has a home in the feed.
2. Applications are saved on the server, with the "Did you apply?" prompt after a download or a trip to the employer's page.
3. The link reader is built: a sealed service that respects `robots.txt`, says who it is, and stops when a site refuses.
4. The `staging` EAS profile points at the AWS demo, and a release can't build on sample data.
5. Crash reports are wired in, waiting for a Sentry account. Usage events go to our own server.

Waiting on you:

1. A fresh OpenRouter key: the one in `.env` has expired, so the live model step is unproven.
2. The LinkedIn and Indeed decision (`toreview.md` §144.3).
3. A Sentry account, and approval for the heavy reader image and the AWS deploy.
4. The phone run: the steps are in `aws/setup/04-local-development.md`, under "Trying the core loop on your phone".

**Done when:** five real people finish upload → tailored resume → PDF on their own phones, with no mock data anywhere in the path.

### Step 2: Fix the flow (2–3 weeks)

**Status, 2026-11-01: the code is done, and the rest needs you.** It's on branch `step-2/fix-the-flow`, on top of Step 1. Nothing is pushed or merged.

Done:

1. There's one "Make a resume for a job" start. It uses your best resume or your profile, with Change to switch.
2. A new account goes straight to its first resume: upload or start from nothing, check jobs and dates, then pick a job. Anyone who skips gets a small card on Home.
3. The whole job has its own page, and Customize shows the plan to reach 8.5 with what each step adds.
4. Running and failed runs sit at the top of History, and the bell reports when they end. Spec §7.2 now says so.
5. Saved resumes open with no connection, and the app says plainly when it's offline.

Waiting on you:

1. A phone pass: none of this has run on a device, and the new screens have no board. Airplane mode is the check for saved resumes.
2. The privacy call on keeping resume text on the phone (`toreview.md` §145.5).
3. The 15-minute test with real people. That's the "done when" below, and it can't be measured from here.

The plan was:

1. Merge Build and Tailor into one "Make a resume for a job" entry point. Keep the two paths as internal detail.
2. Build the first five minutes: upload, confirm employers and dates, get one tailored resume (`WhyNextKin.md` §4.2).
3. Bring the JD page and path-to-8.5 plan across from the web.
4. Give failed and running generations one visible home, and update spec §7.2 to match.
5. Add basic offline viewing of saved resumes, and clear messages when there's no connection.

**Done when:** a new user reaches a first resume in under 15 minutes in testing.

### Step 3: Show the truth (2–3 weeks)

**Status, 2026-11-01: the mobile side is done, and the rest needs you.** It's on branch `step-3/show-the-truth`, on top of Step 2. Nothing is pushed or merged. Web gets its own pass before the joint launch; the server and shared data are ready for it.

Done on mobile:

1. The score screens lead with the required skills, then the parts, then what the score doesn't measure.
2. Every fix says what it rests on.
3. The profile shows where each fact came from, with one tap to confirm.
4. A Versions page says what changed and why, including what the check took out of the AI's draft.
5. A download says what read back from the file, tested on real typeset PDFs in all three page designs.
6. The gap interview asks up to seven short, skippable questions, chosen by code.
7. Tapping any line of a resume says where it came from.

Waiting on you:

1. A phone pass: none of this has run on a device, and most of it has no board.
2. The calls listed in `toreview.md` §146, starting with whether "Confirmed" should show on every profile row.
3. The tester check: pointing at any line and seeing where it came from.

This is where NextKin stops looking like another resume builder (`WhyNextKin.md` §4.5). The plan was:

1. Lead the score card with "x of y required", then the parts, then what the score doesn't measure.
2. Give every fix its basis, e.g. "you tagged this skill at Acme".
3. Show provenance on the profile: confirmed, parsed or assumed.
4. Show "what changed and why" between versions, including what was removed and why.
5. Show an export receipt: "23 of 23 bullets readable".
6. Add the gap interview: up to seven short, skippable questions, decided by code, not by the model.

**Done when:** a tester can point at any line of a resume and see where it came from.

### Step 4: Create the habit (3–4 weeks)

**Status, 2026-11-01: the mobile side is built and tested on the laptop, and the rest needs you.** It's on branch `step-4/create-the-habit`, on top of Step 3. Nothing is pushed or merged. Web gets its own pass before the joint launch.

Done on mobile:

1. Push is built through Amazon SNS, with quiet hours and one nudge a day. It's off until a Firebase project and an Apple key exist.
2. A job can be shared in from any browser or app. LinkedIn and Indeed links go to the paste box with a plain reason.
3. Each application has its own page. Follow-ups ask at 7 and 21 days, and Home shows "5 applied · 1 interview · 2 to check on".
4. Jobs show how they fit on location, workplace and salary. Picks and alerts leave out a clash and say why. There's no sponsorship label, by your call.
5. An application at "Interview" offers practice for that job and a reminder the day before.
6. `pnpm metrics:retention` measures week-4 retention.

Waiting on you:

1. A Firebase project, an Apple Developer account, and an EAS development build. Without them, push and share-in can't run on a phone. Steps are in `aws/setup/07-push.md`.
2. Job providers (D-12). Job alerts stay silent until real listings exist.
3. A phone pass, and the calls in `toreview.md` §147.
4. Real users. "Heading towards 20%" takes real people and at least four weeks.

The plan was:

1. Real push: job matches, finished runs and application follow-ups, all opt-in.
2. Share a job into NextKin from any browser or app, using the link reader from Step 1.
3. Use the saved applications for a Home number and follow-ups.
4. Fit labels next to skills: location, remote, salary and sponsorship, with clear reasons why a job is hidden.
5. Interview prep tied to real applications.

**Done when:** week-4 retention can be measured and is heading towards the 20% target.

### Step 5: Launch (4–6 weeks, mostly waiting on reviews)

1. File the Apple and Google accounts now, because their lead times run in parallel with everything above.
2. Add Sign in with Apple and connect Google.
3. Get a payments ruling, fix the domains, and finish legal review.
4. Run an accessibility pass with TalkBack, VoiceOver and large text.
5. Test on a low-end Android phone, covering launch time, list scrolling and memory.
6. Run a closed beta with real job seekers, then release in stages.

**Launch gate (from spec §2.2):** generation reliability ≥ 98%, zero anachronistic claims on automated checks, ATS rubric mean ≥ 85% on real resumes, and a crash-free rate you've chosen in advance.

---

## 8. Decisions needed from you

**Decided by the owner on 2026-10-31:**

1. **Launch order:** web and mobile launch together (D-06 stands). Mobile's store work now sets the shared date, so the store accounts should be filed straight away.
2. **Expo Go rule:** Expo Go stays for daily screen work. A development build is allowed for release work.
3. **Link reading:** build the real reader now, in Step 1.
4. **Applications:** after a user builds or tailors a resume, or applies to a job through NextKin, ask whether they applied, and save the answer on the server. This changes D-05.

**Still open:**

5. **Job providers (D-12).** This is the largest open product dependency. The job board and match scores aren't real until it's decided.
6. **One flow or two.** **My recommendation:** one, as in Step 2.
7. **Payments on mobile.** Keep the browser checkout or add store billing, once the rule check is back.
8. **Home's run status (§141).** Accept the departure from the spec, or add a smaller indicator. **My recommendation:** a small indicator, shown only while a run is active or has failed.

---

## 9. What this assessment did not cover

- No use of the app on a phone, and no visual comparison with Figma.
- No release build, no performance measurements and no battery or memory testing.
- No run of the backend or of `pnpm test:integration`.
- No AI output quality review.
- Store policy points are from general knowledge and need checking against the current rules.
