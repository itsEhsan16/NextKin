type IncomingShareModule = {
  getSharedPayloads(): { value?: string }[];
  clearSharedPayloads(): void;
};

let cached: IncomingShareModule | null | undefined;

/** Lazy for the same reason as `share.ts`: @/lib is imported by every screen. */
function incomingShareModule(): IncomingShareModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy by necessity, see above.
    cached = require('expo-sharing') as IncomingShareModule;
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * What another app shared with NextKin, handed over once. It waits on the native side until it's
 * taken, so a share that arrives before sign-in is still there after. Experimental in SDK 58, and
 * only a development build can receive one: everywhere else this finds nothing.
 */
export function takeSharedText(): string | null {
  const module = incomingShareModule();
  if (!module) return null;
  try {
    const text = module
      .getSharedPayloads()
      .map((payload) => payload.value?.trim())
      .find(Boolean);
    if (text) module.clearSharedPayloads();
    return text ?? null;
  } catch {
    return null;
  }
}
