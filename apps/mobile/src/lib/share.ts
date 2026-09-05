import { Share } from 'react-native';

/** What the OS sheet did. 'unavailable' means no sheet ever appeared, so callers must say so. */
export type ShareResult = 'done' | 'dismissed' | 'unavailable';

/** Structural stand-in for expo-sharing, so nothing here imports the package at module scope. */
type SharingOptions = { mimeType?: string; dialogTitle?: string; UTI?: string };
type SharingModule = {
  isAvailableAsync(): Promise<boolean>;
  shareAsync(url: string, options?: SharingOptions): Promise<void>;
};

let cached: SharingModule | null | undefined;

/**
 * expo-sharing is required lazily: @/lib is imported by every screen, so a static native import
 * would take every route (and Jest) down with it the moment the module is missing from the
 * runtime. React Native's own Share is core JS, not a native module, so it imports normally.
 */
function sharingModule(): SharingModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy by necessity, see above.
    cached = require('expo-sharing') as SharingModule;
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * Share a string (a job link, a résumé summary) through the platform sheet. Android always
 * resolves 'sharedAction' whatever the user picked, so 'done' means "the sheet closed without a
 * cancel", not "the content reached somewhere".
 */
export async function shareText(
  text: string,
  opts?: { title?: string; url?: string },
): Promise<ShareResult> {
  try {
    const result = await Share.share({ message: text, title: opts?.title, url: opts?.url });
    return result.action === Share.dismissedAction ? 'dismissed' : 'done';
  } catch {
    return 'unavailable';
  }
}

/**
 * Share a local file (an exported PDF) through the same sheet. `isAvailableAsync` is false on
 * web and on devices with no sharing UI, and shareAsync resolves void — there is no dismissal
 * signal to read, so a completed call is 'done'.
 */
export async function shareFile(
  uri: string,
  opts: { mimeType: string; dialogTitle?: string; uti?: string },
): Promise<ShareResult> {
  const module = sharingModule();
  if (!module) return 'unavailable';
  try {
    if (!(await module.isAvailableAsync())) return 'unavailable';
    // The SDK spells the iOS uniform type identifier `UTI` in caps; our prop is lowercase `uti`.
    await module.shareAsync(uri, {
      mimeType: opts.mimeType,
      dialogTitle: opts.dialogTitle,
      UTI: opts.uti,
    });
    return 'done';
  } catch {
    return 'unavailable';
  }
}
