# @nextkin/web

The NextKin web app — **the Release 1 product**, not a companion to mobile. V2 §1.5, §6.1 and
§9.2 are explicit: Release 1 is web-first and native mobile is Phase 2.

```sh
pnpm web          # from the repo root — dev server on :3000
pnpm --filter @nextkin/web build
```

**On the backend** (`NEXT_PUBLIC_DATA_SOURCE=http`), the API runs inside this dev server, and its
instance lives on `globalThis` so hot reloads don't leak database pools. A change to server code
or to the root `.env` (`LLM_ROUTE`, keys, caps) therefore needs a **restart** of the dev server;
a hot reload keeps the old instance.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16, App Router, TypeScript | V2 §9.2 — SSR/ISR is load-bearing for the Skills Explorer and job pages (§7.14, §4.2) |
| Styling | Tailwind v4 + design tokens in `src/theme` | V2 §9.2 and the §14.2 M0 exit criteria |
| Server state | TanStack Query over `@nextkin/shared` repos | Same hooks the mobile app calls |
| Tests | Jest + Testing Library (jsdom) via `next/jest` | Mirrors the mobile gate |
| Deploy target | `output: 'standalone'` on ECS Fargate | V2 §9.5 |

Two `next.config.ts` settings are not stylistic. `compress: false` — the built-in gzip buffers
streamed responses, which would break generation progress (§7.6) and assistant streaming (§7.16);
CloudFront compresses instead. `transpilePackages: ['@nextkin/shared']` — the shared package ships
TypeScript source with no build step.

## Layout

```
apps/web/
├── app/                  routes — thin: each file renders a screen from src/features
│   └── (app)/            the authenticated shell (sidebar + main)
├── assets/               raw Figma exports, committed so icons can be regenerated
├── public/illustrations/ large SVG art served rather than inlined
├── scripts/              build-icons.mjs, build-illustrations.mjs
└── src/
    ├── theme/            tokens.ts + theme.css — the ONLY place a raw value lives
    ├── ui/               generic primitives, plus generated icons/ and illustrations/
    ├── navigation/       the sidebar shell
    ├── features/<area>/  screens and their components
    ├── lib/              cn, storage, format, richText
    └── providers/        query client + mock-mode wiring
```

## Rules

1. **Route files are thin.** A file in `app/` renders a screen from `src/features/<area>/screens`
   and nothing else.
2. **Data flows through queries.** Screens import hooks from `@nextkin/shared/queries`. Reaching
   into `@nextkin/shared/mock` outside tests is an ESLint error — the fixtures are not an API.
   Web seeds the mock layer with its own boards' jobs and applications (`configureMockData()` in
   `src/lib/mockMode.ts`, and `jest.setup.ts` for the tests); every other fixture is mobile's too.
3. **Tokens, never literals.** Colours, type roles, radii and durations live in `src/theme`.
   A raw hex or a raw `220ms` anywhere else is a lint warning. Sizes follow the compact density
   (`toreview.md` §16): the type ramp plus three control heights, `control-sm/md/lg` (30/36/40),
   and every page sits in `src/ui/pageFrame.ts` under the app-wide `navigation/TopBar` (one bar,
   pinned, in the `(app)` layout), opening with the shared `navigation/PageHeader`.
4. **This is not mobile's design system.** The web board binds its own Figma variables — slate
   neutrals, indigo `#4f46e5`. Never port a value from `apps/mobile/src/theme`.
5. **Every screen ships four states** — default, loading, empty, error — exercised through the
   shared mock modes (`useMockModeStore.setState({ mode: 'empty' })`), not by stubbing hooks.
6. **Icons and illustrations are generated, not hand-written.** Commit the Figma export to
   `assets/figma-icons/<board>/` or `assets/figma-illustrations/<board>/`, then
   `node scripts/build-icons.mjs` or `node scripts/build-illustrations.mjs`. Icons are not simply
   recoloured: the board draws each glyph as navy ink plus near-white *knockout* paths that punch
   its holes, so the generator splits them by luminance and emits a mask — the holes stay
   transparent on any background. Illustrations keep their fills, and their `<defs>` when the
   artwork paints from a gradient.
   The resume flows (upload, JD page, create, tailor, resumes, editor) draw their line icons from
   Untitled UI's own package instead, through `src/ui/lineIcons.ts`, sized with its `iconSize`
   (toreview §131). Add a glyph there, not as a direct `@untitledui/icons` import.
   Those flows also share `ui/Button` (variants, sizes, a self-guarding `loading`), `ui/Spinner`,
   `ui/SegmentedControl`, `ui/Callout` and `ui/textLink`. Reach for them before styling a control
   locally.
7. **WCAG 2.1 AA** (§8.7): keyboard operability, visible focus, live regions for async progress,
   and `prefers-reduced-motion` — which `theme.css` enforces globally so a component cannot forget.

## Screens

Built from the Figma file one at a time, as on mobile.

| Screen | Figma | State |
| --- | --- | --- |
| App shell — sidebar | `304:497` expanded, `304:600` rail | ✅ Both states, 8 destinations |
| Home | `286:180` | ✅ Six cards, four states |
| Jobs | `304:2332` | ✅ Master-detail, four states; only the job list scrolls; `?job=<id>` opens one |
| Applications | `286:1234` | ✅ Status pills, filters, Update Status, four states; only the list scrolls |
| Resumes | `286:1675` | ✅ Pills, filters, search, preview / details / score / history tabs, Create, Download; only the list scrolls |
| Documents | `286:2026` | ✅ Search, sort, list/grid, type pills, certificate / photo previews, four states; only the list scrolls |
| Account | `307:3443` | ✅ Profile as drawn; Preferences, Subscription, Security, Integrations from the data; Notifications is Settings → Notifications' card over the same data; `?tab=<section>`; reached from the header avatar and the sidebar's user chip |
| Settings | `254:326` Account, `356:2` Preferences, `247:1094` Notifications; Privacy & data and Connected accounts from mockups | ✅ Account, Preferences and Notifications as drawn: details, password, two-factor, signed-in devices; job preferences (Edit unlocks, each change saves), app settings, content & AI switches, the help column; three channels and seven topics on each, Reset to default. Privacy & data and Connected accounts from the user's mockups (`toreview.md` §30): visibility and privacy switches saved as they change, the data export, two-factor and sessions; Google alone, per V2 §7.1. The other three sections are coming-soon panels; `?tab=<section>`; reached from the sidebar's Settings row |
| Onboarding (`/onboarding`) | `807:3`, `826:2`, `807:136`, `807:215`, `808:2`, `808:88`, `808:175`, `808:266`, `808:348` (ONB 01–08) | ✅ Name, goal, experience, resume, then either the upload (04b) or three quick questions (05 recent work, 06 skills suggested from the job title, 07 education, year-precise), ending on 08's starting point: a draft summary built only from the answers, next steps, and Go to my dashboard. Each step saves to the profile as it continues. Outside the app shell; the upload's draft waits for an undrawn review screen (`toreview.md` §107) |
| Resume editor (`/resumes/<id>/edit`) · Document viewer (`/documents/<id>`) · Interview Prep · Insights · AI Assistant · Help · Upgrade | — | 🚧 `ComingSoon` placeholders |

## Verifying against the boards

Playwright drives the **installed** Edge or Chrome, so no browser download is needed:

```js
chromium.launch({ channel: 'msedge' })  // or 'chrome'
```

Render at 1536x1024 (the board's frame) and compare region by region. Since `toreview.md` §16
the build is deliberately denser than the boards, so compare composition and proportion, not
raw pixels — and check a laptop-sized window (1536x730) too. Hide
Next's dev overlay first — `nextjs-portal{display:none!important}` — or it sits over the sidebar
footer.

Home and the sidebar have had that pass; see `toreview.md` §10. **Still unverified:** keyboard and
screen-reader operation, an axe run, and every breakpoint below 1536 (`toreview.md` §9.4).
