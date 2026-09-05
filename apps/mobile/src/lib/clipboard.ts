/** Structural stand-in for expo-clipboard, so nothing imports the package at module scope. */
type ClipboardModule = {
  setStringAsync(text: string): Promise<boolean>;
};

let cached: ClipboardModule | null | undefined;

/**
 * expo-clipboard is required lazily: @/lib is imported by every screen, so a static native import
 * would take every route (and Jest) down with it if the module is missing from the runtime.
 */
function clipboardModule(): ClipboardModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy by necessity, see above.
    cached = require('expo-clipboard') as ClipboardModule;
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * Copy text (a referral link, an application id) to the system clipboard. iOS 14+ shows its own
 * "pasted" banner, so callers still confirm with a Toast rather than relying on the OS.
 */
export async function copyToClipboard(text: string): Promise<'done' | 'unavailable'> {
  const module = clipboardModule();
  if (!module) return 'unavailable';
  try {
    await module.setStringAsync(text);
    return 'done';
  } catch {
    return 'unavailable';
  }
}
