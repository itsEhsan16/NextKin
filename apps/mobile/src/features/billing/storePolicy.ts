import { Platform } from 'react-native';

/**
 * Whether this build may sell Pro, or point at a place that does.
 *
 * Google Play's Payments policy: a digital subscription bought from inside an Android app goes
 * through Play Billing, and the app may not lead the reader to another way to pay. The app's only
 * checkout is the web's (D-18), so on Android v1 the plan screen explains the plans and the
 * reader's limits but offers no checkout, no price-to-buy button and no link to the web billing
 * page (owner, 2026-11-20). Buying stays on the website. iOS keeps today's behaviour until its own
 * store pass.
 *
 * Read through a function rather than a constant so tests can flip `Platform.OS`.
 */
export function sellsInApp(): boolean {
  return Platform.OS !== 'android';
}

/** The Android plan screen's footer line for a Free reader. Names no other place to pay. */
export const STORE_FREE_NOTE = "Pro can't be bought in the Android app yet. Free keeps working.";
/** The Android plan screen's footer line for a Pro reader. */
export const STORE_PRO_NOTE = 'Your plan is managed outside this app.';
export const STORE_DONE_CTA = 'Done';
/** What the small "Upgrade" links say where nothing can be bought: they open the plans page. */
export const upgradeLinkLabel = () => (sellsInApp() ? 'Upgrade' : 'See plans');
