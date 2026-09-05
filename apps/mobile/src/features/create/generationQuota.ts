import { pluralize } from '@/lib';

/**
 * What the create flow says about this month's generation allowance (V2 §13.5).
 *
 * Two screens spend a generation — the tailor intake starts the extraction that leads to one,
 * and the JD review screen presses the button that actually spends it — so the copy lives here
 * once rather than drifting between them.
 */

/**
 * The cost of the press, said on the bar that makes it. This is not the cap: `UsageBanner` above
 * says how many are left, and this line says what pressing the button uses up.
 */
export const GENERATION_COST_NOTE = "Counts as one of this month's generations";

/**
 * What the bar says once the allowance is gone. A plan that grants none reaches this too — 0 of 0
 * is spent — and "This month's 0 generations are used" is not a sentence.
 */
export const spentNote = (limit: number): string =>
  limit > 0
    ? `This month's ${pluralize(limit, 'generation')} are used. Pro raises the monthly cap.`
    : 'Your plan has no generations this month. Pro raises the monthly cap.';
