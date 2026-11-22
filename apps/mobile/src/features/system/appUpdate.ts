import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

import type { AppVersionPolicy } from '@/data/queries';
import { openExternalUrl, storage } from '@/lib';

/**
 * The app's own update prompts (toreview §245). Two kinds:
 * - **Required:** this build is below the server's floor (`/app/version` says so, or any request
 *   was answered 426). The app shows only the update screen; nothing else would work anyway.
 * - **Available:** a newer version is in the store. Offered once per version, and "Not now" holds
 *   until the next release.
 */

/** The version this build reports, the same one the HTTP client sends as X-Client-Version. */
export const CURRENT_VERSION = Constants.expoConfig?.version ?? '0.0.0';

/** -1, 0 or 1, comparing dotted numeric versions ("1.10.0" is after "1.9.3"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

export const isBelow = (version: string, target: string | null | undefined): boolean =>
  target != null && compareVersions(version, target) < 0;

const DISMISSED_KEY = 'appUpdate.dismissed';

/** The latest version the reader said "Not now" to. */
export const dismissedVersion = (): string | null => storage.get<string>(DISMISSED_KEY);
export const dismissVersion = (version: string): void => storage.set(DISMISSED_KEY, version);

export type UpdateState = 'none' | 'available' | 'required';

/** What to show, from the policy, a 426 seen this run and what was already dismissed. */
export function updateState({
  policy,
  forced,
  current = CURRENT_VERSION,
  dismissed,
}: {
  policy: AppVersionPolicy | undefined;
  forced: boolean;
  current?: string;
  dismissed: string | null;
}): UpdateState {
  if (forced || isBelow(current, policy?.minimum)) return 'required';
  const latest = policy?.latest;
  if (latest && isBelow(current, latest) && dismissed !== latest) return 'available';
  return 'none';
}

const ANDROID_PACKAGE = Application.applicationId ?? 'com.nextkin.app';

/**
 * Where an update comes from. Android opens the Play Store app straight on our listing, or the
 * listing on the web when the Store app is missing. iOS has no App Store listing yet, so there is
 * nowhere to send anyone and the screens say so in words.
 */
export const canOpenStore = Platform.OS === 'android';

export async function openStore(): Promise<'done' | 'unavailable'> {
  if (Platform.OS !== 'android') return 'unavailable';
  try {
    await Linking.openURL(`market://details?id=${ANDROID_PACKAGE}`);
    return 'done';
  } catch {
    return openExternalUrl(`https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`);
  }
}
