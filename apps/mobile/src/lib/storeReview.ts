/** Structural stand-in for expo-store-review, so nothing imports the package at module scope. */
type StoreReviewModule = {
  isAvailableAsync(): Promise<boolean>;
  hasAction(): Promise<boolean>;
  requestReview(): Promise<void>;
};

let cached: StoreReviewModule | null | undefined;

/**
 * expo-store-review is required lazily: @/lib is imported by every screen, so a static native
 * import would take every route (and Jest) down with it if the module is missing from the runtime.
 */
function storeReviewModule(): StoreReviewModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy by necessity, see above.
    cached = require('expo-store-review') as StoreReviewModule;
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * Ask the OS for the in-app rating card. The library defines `hasAction()` as
 * `!!storeUrl() || isAvailableAsync()` — an OR, not a store-URL requirement — so with neither
 * ios.appStoreUrl nor android.playStoreUrl in app.config.ts it still resolves true wherever the
 * native module exists, Expo Go included (expo-store-review is a bundled module). So
 * `isAvailableAsync()` is the real gate, and 'requested' only ever means "the OS was asked":
 * SKStoreReviewController and Play In-App Review are both rate-limited and silently do nothing.
 * Callers must treat 'requested' and 'unavailable' alike as non-confirmations — show a Toast, and
 * never say the user rated us.
 */
export async function requestStoreReview(): Promise<'requested' | 'unavailable'> {
  const module = storeReviewModule();
  if (!module) return 'unavailable';
  try {
    if (!(await module.isAvailableAsync())) return 'unavailable';
    // Redundant against the real module, where isAvailableAsync() implies hasAction(); it only
    // separates the native-module-missing + store-URL-present case, which this config cannot
    // reach. Kept so a build that does configure store URLs still goes through the same gate.
    if (!(await module.hasAction())) return 'unavailable';
    await module.requestReview();
    return 'requested';
  } catch {
    return 'unavailable';
  }
}
