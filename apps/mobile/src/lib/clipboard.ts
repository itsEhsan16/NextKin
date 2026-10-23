import { Platform } from 'react-native';

/** Structural stand-in for expo-clipboard, so nothing imports the package at module scope. */
type ClipboardModule = {
  setStringAsync(text: string): Promise<boolean>;
  getStringAsync(): Promise<string>;
  hasStringAsync(): Promise<boolean>;
  /** iOS only. Asks whether a URL is there without reading it, so no paste prompt appears. */
  hasUrlAsync?(): Promise<boolean>;
  /** iOS only. */
  getUrlAsync?(): Promise<string | null>;
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

/**
 * What is on the clipboard, read only when it can be a link (TAILOR 00c), or null. iOS asks
 * "Allow Paste?" on every read, so it is asked first whether a URL is there at all — a question
 * that shows no prompt — and the read happens only when one is. Android reads plain text and
 * shows its own "pasted" toast on 13+; that is the OS, not something the app can hide.
 */
export async function readClipboardLink(): Promise<string | null> {
  const module = clipboardModule();
  if (!module) return null;
  try {
    if (Platform.OS === 'ios' && module.hasUrlAsync && module.getUrlAsync) {
      if (!(await module.hasUrlAsync())) return null;
      return (await module.getUrlAsync()) ?? null;
    }
    if (!(await module.hasStringAsync())) return null;
    return (await module.getStringAsync()) || null;
  } catch {
    return null;
  }
}
