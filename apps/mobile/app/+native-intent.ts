/**
 * Android and iOS hand a share over as a system URL with no matching route. Home is where it lands:
 * `ShareHost` takes it from there once someone is signed in, so a share made while signed out isn't
 * lost at the sign-in screen. Every other link passes through untouched.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return new URL(path).hostname === 'expo-sharing' ? '/' : path;
  } catch {
    // A plain path, which is what an in-app link looks like.
    return path;
  }
}
