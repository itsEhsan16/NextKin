# NextKin mobile app

React Native app for NextKin Apply, built with **Expo SDK 57** (React Native 0.86, React 19.2,
New Architecture, Hermes), **Expo Router**, TypeScript `strict`, Reanimated 4 and FlashList v2.

The current milestone is **UI end-to-end**: every screen runs against a typed mock data layer
shaped like the V2 spec's data model and API, so the real API client drops in later without
touching screens. There is no backend, auth or network access yet.

- Binding product spec: `doc/NextKin-Apply-V2-Project-Specification.md` (repo root)
- Implementation plan: `doc/NextKin-Mobile-UI-Implementation-Plan.md`
- Agent conventions: `CLAUDE.md` at the repo root

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
    _layout.tsx          providers (Query, gesture root, SafeArea, theme), font gate, splash hide
    (tabs)/              tab routes (Home, Jobs, Resumes, Profile) + the floating tab bar host
    dev/                 __DEV__-only token gallery and motion playground
  src/
    theme/               tokens.ts (colours, spacing, radii, sizes, shadows), typography.ts,
                         motion.ts, appearance.ts, index.ts (useTheme)
    ui/                  primitives, one folder each (Text, Pressable, Button, Card, Sheet, ...)
    navigation/          FloatingTabBar, Fab, shared sheet-progress value
    providers/           app-level providers composed by app/_layout.tsx
    features/<area>/     screens/, components/, hooks/, store.ts per product area
    data/
      models/            TypeScript types mirroring the V2 spec entities
      mock/              fixtures (same copy as Figma), simulated latency, seed data
      repos/             repository interfaces + mock implementations (the ONLY thing swapped later)
      queries/           TanStack Query hooks - screens import ONLY these
    lib/                 haptics, storage (expo-sqlite/kv-store), format, a11y, reducedMotion
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
4. **Tokens, never literals.** Styling is `StyleSheet.create` + `useTheme()`; every colour comes
   from theme tokens (hex literals live only in `src/theme`). No NativeWind / utility classes.
5. **Motion is Reanimated 4 + motion tokens.** Animations run as worklets using
   `theme.motion` (`springs`, `timings`, `stagger`, `scales`); no inline durations, no RN core
   `Animated`. Respect `useReducedMotion()` via `withReducedMotion()`.
6. **Every list is FlashList v2**, rows are memoised and keyed by id; images go through
   `expo-image`.
7. **Strict TypeScript, named exports, focused files** (< 250 lines). `tsc --noEmit` and
   `expo lint` must pass with zero errors.
8. **Accessibility is not optional**: roles/labels/states, 44 pt hit targets (`hitSlopFor`),
   `maxFontSizeMultiplier` on dense chrome (`maxFontScale`).

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
  expo-notifications permission APIs, react-native-svg). Do not add dependencies without
  checking them against the Expo Go runtime first.
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
