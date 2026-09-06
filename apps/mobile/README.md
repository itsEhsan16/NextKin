# NextKin mobile app

React Native app for NextKin Apply, built with **Expo SDK 57** (React Native 0.86, React 19.2,
New Architecture, Hermes), **Expo Router**, TypeScript `strict`, Reanimated 4 and FlashList v2.

The current milestone is **UI end-to-end**: every screen runs against a typed mock data layer
shaped like the V2 spec's data model and API, so the real API client drops in later without
touching screens. There is no backend, auth or network access yet.

The binding product specification and the UI implementation plan are kept internally and are not
part of this repository.

## Run it in Expo Go

Expo Go (SDK 57) on a physical device is the verification target until an Expo/EAS account
exists. Your phone and computer must be on the same Wi-Fi (or use `--tunnel`).

```sh
# from the repository root
pnpm install          # installs the whole workspace (Node 22, pnpm 11)
pnpm mobile           # = pnpm --filter @nextkin/mobile start  -> runs `expo start`
```

Then scan the QR code printed in the terminal with the Expo Go app (Android) or the Camera app
(iOS). Press `a` / `i` in the terminal to open an emulator or simulator instead.

If the device cannot reach Metro over the LAN, run `pnpm --filter @nextkin/mobile exec expo start --tunnel`.

For perf checks use the release-like mode (`pnpm --filter @nextkin/mobile start:prod`) and
Expo Go's Perf Monitor (shake the device, then "Show Perf Monitor").

## Scripts

Run from `apps/mobile` (or through `pnpm --filter @nextkin/mobile <script>` from the root).

| Script       | What it does                                             |
| ------------ | -------------------------------------------------------- |
| `start`      | `expo start` (dev server + QR code for Expo Go)          |
| `start:prod` | `expo start --no-dev --minify` (release-like JS bundle)  |
| `android`    | `expo start --android` (opens the connected device/AVD)  |
| `ios`        | `expo start --ios` (opens the iOS simulator, macOS only) |
| `typecheck`  | `tsc --noEmit` (strict + `noUncheckedIndexedAccess`)     |
| `lint`       | `expo lint` (ESLint flat config in `eslint.config.js`)   |
| `test`       | `jest` (`jest-expo` preset + Testing Library)            |

Root-level shortcuts: `pnpm typecheck`, `pnpm lint`, `pnpm test` run the same scripts for every
workspace package. All three must be green before a change is considered done.

## Folder structure

```
apps/mobile/
  app.config.ts          scheme "nextkin", portrait, userInterfaceStyle automatic, typedRoutes
  app/                   expo-router routes - THIN: each file just renders a feature screen
    _layout.tsx          providers (Query, gesture root, SafeArea, theme), font gate, splash hide,
                         and the session gate: every signed-in route is declared inside it
    (auth)/              sign-in stub; the real §7.1 screens are design-gated
    (tabs)/              tab routes (Home, Jobs, Resumes, Profile) + the floating tab bar host
    create/              the intakes that start a run: tailor, JD review, cover letter,
                         ATS check, Zero Resume, upload + its review, LinkedIn (unavailable)
    resumes/[id]/        the document editor, its per-section editor, the score panel, the
                         published rubric and the ATS fix list
    profile/             the §7.3 editors: identity, skills, desired roles, locations, and a
                         list + form pair for experience, education, certifications and links
    jobs/[id]/           the listing, the employer behind it, and the full match breakdown
    support/             help and the contact form; legal/[doc] holds terms and privacy
    account/             email, password and sessions; the §8.5 data export
    upgrade.tsx          the plan screen - the single destination for every paywall (§13.5)
    dev/                 __DEV__-only gallery: tokens, type, motion, mock modes, filters, forms
  src/
    theme/               tokens.ts (colours, spacing, radii, sizes, shadows), typography.ts,
                         motion.ts, appearance.ts, index.ts (useTheme)
    ui/                  primitives, one folder each (Text, Pressable, Button, Card, Sheet, ...)
    navigation/          FloatingTabBar, Fab, shared sheet-progress value
    providers/           app-level providers composed by app/_layout.tsx
    features/<area>/     screens/, components/, hooks/, store.ts per product area
                         (auth holds the mock session store alongside its screen; billing is
                         the plan screen and its pure price/copy module; support and account are
                         the help, contact, legal and account screens and their pure copy modules)
    data/
      models/            TypeScript types mirroring the V2 spec entities
      mock/              fixtures (same copy as Figma), simulated latency, seed data, and the
                         builders that write a document or read a job description
      repos/             repository interfaces + mock implementations (the ONLY thing swapped later)
      queries/           TanStack Query hooks - screens import ONLY these
    lib/                 haptics, storage (expo-sqlite/kv-store), format, a11y, reducedMotion, and
                         the lazy wrappers over the native modules (pickers, share, files, browser)
  __tests__/             jest + @testing-library/react-native (mirrors src/ by folder)
  .maestro/              device E2E flows, added per area from Phase 3
```

### Architecture rules

These are enforced by code review and, where possible, by ESLint:

1. **Route files are thin.** Files in `app/` render a screen component from `src/features`;
   they never contain UI or data logic.
2. **Data flows through queries.** Screens and components import hooks from `@/data/queries`
   only. Importing `@/data/mock/*` outside `src/data/**`, tests and the dev gallery is an ESLint
   error (`no-restricted-imports`).
3. **Primitives stay generic.** Nothing in `src/ui` imports from `src/features`.
4. **Tokens, never literals.** Styling is `useTheme()` + `scaledSheet()`; every colour comes
   from theme tokens (hex literals live only in `src/theme`). No NativeWind / utility classes.
5. **Every length is scaled by one factor. Type is measured on two artboards.** The Figma frames
   are 520px wide and phones are 360–430dp, so `useTheme()` returns tokens already projected
   onto the device by `width / 520` — spacing, radii, sizes, shadow offsets, leading and
   tracking alike. There are no per-value floors in that half: a floor makes one element stop
   shrinking while its neighbours carry on, which is how text ends up too large for the box
   drawn around it.
   - Font *size* is the exception, and it is the designers'. The file draws every screen twice:
     the "Mobile App" page at 520 and the "Mobile 2" page at 390. Mobile 2 is Mobile App at
     exactly ×0.75 for every box, gap, radius and leading — but its font sizes were deliberately
     held back, more the smaller the role, so text stays legible in boxes that shrank. Each role
     in `typography.ts` therefore carries both measurements and `typographyFor()` reads between
     them. 390 is a phone width, not a midpoint, so it is also the floor: under it the boxes keep
     scaling but the type holds. Body lands at 13 on a 390dp phone and still 13 on a 360dp one,
     against 11.25 and 10.38 under the old single-factor policy.
   - `s(px)` off `useTheme()` scales a raw artboard number. Never pass it a value that came
     *from* the theme — that squares the factor.
   - Module scope cannot see the device width, so a length inside `StyleSheet.create` renders at
     its raw 520px size. Use `scaledSheet((s) => ({ … }))` instead; ESLint warns on the rest.
   - A component prop naming a design dimension takes a device-space value. If it also has a
     default or branches on the number, scale those too (see `LogoTile`, `ScoreRing`).
   - Exempt: `radii.full`, `sizes.designWidth`, `sizes.minHitTarget`, safe-area insets, shadow
     alpha and Android elevation. `__tests__/theme/scaledTheme.test.ts` pins all of it, and
     `typeRamp.test.ts` guards the hand-transcribed 390 column against a slipped digit.
   - Two dev tools check the result on device, both in `app/dev`: **artboard mode** lays the
     whole tree out at 520 and scales it, so anything that jumps when you toggle it is an
     unscaled literal; the **Figma overlay** puts the artboard render over the live screen, with
     a 390/520 switch for the two pages. On a 390dp phone the 390 render is 1:1.
6. **Motion is Reanimated 4 + motion tokens.** Animations run as worklets using
   `theme.motion` (`springs`, `timings`, `stagger`, `scales`); no inline durations, no RN core
   `Animated`. Respect `useReducedMotion()` via `withReducedMotion()`.
7. **Every list is FlashList v2**, rows are memoised and keyed by id; images go through
   `expo-image`.
8. **Strict TypeScript, named exports, focused files** (< 250 lines). `tsc --noEmit` and
   `expo lint` must pass with zero errors.
9. **Accessibility is not optional**: roles/labels/states, 44 pt hit targets (`hitSlopFor`),
   `maxFontSizeMultiplier` on dense chrome (`maxFontScale`).
10. **Session gating.** `app/_layout.tsx` declares every signed-in route inside a
    `<Stack.Protected>`; a route left outside one stays reachable, so a deep link could open over
    the sign-in screen. New route files register in that block. The mock session defaults to
    `signed_in` and is read synchronously, so the first frame is already correct; signing out
    clears the query cache and the mock store *before* flipping it, because the flip unmounts the
    tab subtree the confirm sheet lives in.
11. **Keyboard.** A form is a pushed screen:
    `<Screen keyboard scroll header={<ScreenHeader/>} footer={<StickyActionBar/>}>`, where the
    footer owns the bottom safe area. A sheet holds at most one text field and sets
    `avoidKeyboard`; anything larger belongs on a screen.
12. **Native modules are lazily required behind `src/lib/*`** (`pushPermission.ts` is the model).
    Screens never import an `expo-*` module directly: `@/lib` is imported by every screen, so a
    static native import would take every route — and Jest, which mocks none of them — down with
    it. Each wrapper degrades to `null` or `'unavailable'` rather than throwing.

13. **A gated control names the limit it hit.** Every paywall routes to `/upgrade` with an
    `UpgradeReason` (`src/features/billing/upgradeReasons.ts`), and the plan screen leads with
    that line instead of a generic pitch (V2 §13.5). Three rules travel with it: the cap is on
    screen *before* the work, not after it is refused; a spent quota **replaces** the primary
    action rather than interrupting with an alert; and an allowance that could not be *read* is
    unknown, not unlimited — so a failed subscription query is an error state, never an open gate.
    Say the number **once** per page: the usage banner owns it, and the action bar's note says
    what the press costs.

14. **A sheet host raised from a pushed screen is mounted twice.** `app/(tabs)/_layout.tsx`
    hosts the chrome sheets, but a pushed screen sits *above* that layout in the stack, so a
    sheet raised there would paint behind the page that asked for it. Such a host takes a
    `surface` prop (`'tabs' | 'editor'`), the store records the surface the sheet was opened
    from, and only the matching mount renders — one paint, one scrim, one `BackHandler`.
    `ResumeMenuHost` and `ResumeExportHost` are the two that do this today.

## Per-screen recipe

Each Figma screen is delivered as one self-contained unit (see plan §6):

1. **Intake** - fetch the Figma node's design context and screenshot; read nearby annotations.
2. **Map** - list the tokens used (add missing ones to `src/theme`), the primitives needed (build
   missing ones in `src/ui` first), and the mock data shape; write fixtures with the same copy as
   Figma.
3. **Build** - `src/features/<area>/screens/<Name>Screen.tsx` + components; the route file in
   `app/` just renders it. Implement all four states: default, loading (skeleton), empty, error.
4. **Motion** - apply the motion tokens; every interactive element has press feedback; gestures
   per annotation.
5. **A11y** - roles, labels, states, hit targets, Dynamic Type sanity, contrast.
6. **Verify** - compare side-by-side with the Figma screenshot on device, check the Perf
   Monitor, add an RNTL test for the states and a Maestro step, register the screen in `app/dev`.
7. **Commit** - one commit per screen, no AI-attribution trailers.

## Testing

```sh
pnpm --filter @nextkin/mobile test            # whole suite
pnpm --filter @nextkin/mobile test -- --watch # watch mode
```

- `jest.setup.ts` mocks Reanimated (its shipped jest mock), `expo-haptics`, and
  `expo-sqlite/kv-store` (in-memory Map), so `@/lib` and `@/theme` import cleanly in tests.
- `@testing-library/react-native` v14 renders asynchronously: `render`, `renderHook`, `rerender`,
  `unmount` and `act` all return promises, so `await` them.
- Matchers are built in; do not import `extend-expect`.

## Expo Go constraints

Until an Expo/EAS account exists the app must run unmodified inside Expo Go, which means:

- **No custom native modules.** Only libraries bundled in the Expo Go SDK 57 runtime may be used.
  Everything currently installed qualifies (Reanimated 4 + worklets, Gesture Handler, Screens,
  Safe Area Context, FlashList v2, expo-image, expo-font, expo-haptics, expo-sqlite,
  expo-notifications permission APIs, react-native-svg, and — added in Phase 9A —
  expo-document-picker, expo-image-picker, expo-sharing, expo-file-system, expo-print,
  expo-clipboard, expo-web-browser and expo-store-review). Do not add dependencies without
  checking them against the Expo Go runtime first.
- **Two of those are weaker than they look in Expo Go.** `expo-store-review` needs store URLs in
  `app.config.ts` to have an action at all, and DOCX cannot be rendered on device — the mock's
  export returns render inputs and the screen prints a PDF or writes text.
- **`expo-file-system` is the SDK 57 class API** (`File`, `Paths`); the function API it replaced
  now lives behind `expo-file-system/legacy` and is deprecated.
- **Deferred until dev builds:** `expo-dev-client`, EAS Build/Update, `react-native-mmkv`
  (preferences use `expo-sqlite/kv-store` instead), `@react-native-vector-icons/*`
  (icons come from `@expo/vector-icons`, bundled in Expo Go).
- **Push delivery is out of scope.** `expo-notifications` is used only for the permission prompt;
  remote push needs a dev build and a backend.
- **Perf budgets are measured in release-like mode** (`start:prod`) in Expo Go and re-validated on
  a real release build once EAS is set up. Dev-mode frame drops are not a regression.
- **Config plugins that change native code have no effect** in Expo Go; keep `app.config.ts` to
  settings Expo Go honours (scheme, orientation, splash, icons, interface style).
- **Expo Go must match SDK 57.** If the store version of Expo Go moves ahead, pin the matching
  Expo Go build on the test device before upgrading the SDK.
