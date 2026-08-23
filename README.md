# NextKin

> **NextKin Apply** — AI resume builder, ATS optimization and job search, as a mobile app.
> Tailor a resume to a specific role, score it against the job description, discover matching
> jobs and track every application in one place.

This repository is the pnpm monorepo for the product. The React Native app in
[apps/mobile](apps/mobile/) is the first workspace; the Next.js web app and the shared
types/schemas package follow later, per the V2 specification.

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2057-000020?logo=expo&logoColor=white)](https://docs.expo.dev/versions/v57.0.0/)
[![React Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)

---

## Status

**Milestone: UI end-to-end on a mock data layer.** There is no backend, auth or network access
yet — every screen runs against a typed fixture layer shaped like the V2 data model and API, so
the real API client drops in later without touching a single screen.

| Area | Screens | State |
| --- | --- | --- |
| Foundation | — | ✅ Workspace, theme + motion tokens, mock data layer, dev gallery |
| App shell | Floating tab bar, FAB, create sheet | ✅ Done |
| Home | `DESIGN 2` | ✅ Done |
| Create | `CREATE 01`, `CREATE 02` | ✅ Done |
| Jobs | `JOBS 01`–`JOBS 03` (Discover / Saved / Applied) | ✅ Done |
| Jobs | `JOBS 04`–`JOBS 08` (Filters, Detail, empty states) | ⏳ Next |
| Resumes | `RESUMES 01`–`RESUMES 05` | ⏳ Planned |
| Profile | `PROFILE 01`–`PROFILE 02` | ⏳ Planned |
| Notifications | `NOTIF 01`–`NOTIF 07` | ⏳ Planned |

Screens are delivered from Figma **one at a time**, each as a self-contained unit that ships all
four states (default, loading, empty, error), press feedback, motion and accessibility before it
is considered done.

## Quick start

Requires **Node 22**, **pnpm 11** and the **Expo Go** app (SDK 57) on a physical device.

```sh
pnpm install     # installs the whole workspace
pnpm mobile      # starts the Expo dev server and prints a QR code
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). Your phone and computer must be
on the same Wi-Fi; otherwise run `pnpm --filter @nextkin/mobile exec expo start --tunnel`.

The app also ships a `__DEV__`-only gallery at `/dev` — colour and spacing tokens, the type ramp,
a motion playground and a mock-data mode switch.

### Scripts

| Command | What it does |
| --- | --- |
| `pnpm mobile` | Expo dev server + QR code for Expo Go |
| `pnpm mobile:android` / `pnpm mobile:ios` | Open on a connected device, emulator or simulator |
| `pnpm typecheck` | `tsc --noEmit` across every workspace (strict + `noUncheckedIndexedAccess`) |
| `pnpm lint` | ESLint flat config (`eslint-config-expo` + Prettier) |
| `pnpm test` | Jest (`jest-expo`) + React Native Testing Library |

All three checks must be green before a change is done.

## Repository layout

```
NextKin/
├── apps/
│   └── mobile/            @nextkin/mobile — Expo SDK 57 app (see its README)
│       ├── app/           expo-router routes — thin: each file renders a feature screen
│       └── src/
│           ├── theme/     colour / spacing / radii / shadow / typography / motion tokens
│           ├── ui/        generic primitives (Text, Button, Card, Sheet, Chip, …)
│           ├── navigation/floating tab bar, FAB, create-sheet host
│           ├── features/  one folder per product area: screens, components, hooks, store
│           ├── data/      models → mock fixtures → repositories → TanStack Query hooks
│           └── lib/       haptics, storage, formatting, a11y, reduced-motion helpers
└── packages/              shared types + zod schemas (added with the web app)
```

## Tech stack

| Concern | Choice |
| --- | --- |
| Runtime | Expo SDK 57 (React Native 0.86, React 19.2, New Architecture, Hermes) |
| Routing | Expo Router (typed routes), custom floating tab bar |
| Motion | Reanimated 4 + Worklets, Gesture Handler — UI-thread only |
| Lists | FlashList v2 · images through `expo-image` |
| Server state | TanStack Query v5 over a mock repository layer with simulated latency |
| Client state | Zustand (per-feature slices) |
| Forms | React Hook Form + zod |
| Styling | `StyleSheet.create` + typed theme tokens, dark-mode ready |
| Storage | `expo-sqlite/kv-store` for UI preferences |
| Testing | Jest (`jest-expo`) + React Native Testing Library · Maestro for device E2E |

**Expo Go is the verification target**, so every dependency must run inside the Expo Go SDK 57
runtime — no custom native modules, no `expo-dev-client`, no `react-native-mmkv`. Install with
`npx expo install` so versions match the SDK.

## Architecture rules

1. **Route files are thin.** Files in `app/` render a screen from `src/features/<area>/screens`
   and nothing else.
2. **Data flows through queries.** Screens import hooks from `@/data/queries` only; reaching into
   `@/data/mock/*` outside `src/data/**` is an ESLint error. Swapping the repositories in
   `src/data/repos` is the only change the real API requires.
3. **Tokens, never literals.** Colours come from semantic theme tokens — hex values exist only in
   `src/theme`.
4. **Motion is a token too.** Every animation is a Reanimated worklet driven by `theme.motion`
   (springs, timings, stagger, scales), and honours reduced motion.
5. **Primitives stay generic.** Nothing in `src/ui` imports from `src/features`.
6. **Every screen ships four states**, press feedback on each interactive element, and
   accessibility roles, labels and 44 pt hit targets.
7. **TypeScript strict**, named exports, files under ~250 lines, Prettier
   (`singleQuote`, `trailingComma: all`, `printWidth: 100`).

## Documentation

[apps/mobile/README.md](apps/mobile/README.md) covers running the app, its folder structure,
testing notes and the Expo Go constraints. The product specification and the implementation plan
are kept internally and are not part of this repository.

## License

Proprietary and confidential. All rights reserved — not licensed for public use or redistribution.
