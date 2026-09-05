# Maestro flows

Device E2E flows live here, one file per product area (`jobs.yaml`, `resumes.yaml`, ...), added from Phase 3 onwards as each area's screens land.
Run against Expo Go on a device: start Metro with `pnpm mobile`, open the app in Expo Go, then from `apps/mobile` run `maestro test .maestro/<flow>.yaml` (Maestro CLI installed separately; set `appId` to `host.exp.exponent` on Android or `host.exp.Exponent` on iOS while on Expo Go).
Flows must navigate via accessibility labels/test IDs, never coordinates.

Every product flow starts with `- runFlow: signIn.yaml`, which taps "Continue with Google" *only if* that button is on screen. The mock session persists (`prefs.session`), so a run that follows a manual sign-out would otherwise fail at the first assertion in every file — and `clearState` is not a way out, because the `appId` is Expo Go itself and clearing it would wipe the dev client rather than the app under test.
