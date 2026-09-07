import { SCORE_LABEL, type JdFile, type Resume, type SubscriptionUsage } from '@/data/models';
import { pluralize } from '@/lib';

/**
 * The rules and the copy behind the standalone ATS check (V2 §7.8 / §4.1): which document a check
 * would run against, whether this month's allowance can pay for it, and what the action bar says.
 *
 * Pure and separate from the screen, the way `jdSkillEdits` and `sectionEdits` are: "an already
 * scored document costs nothing to open" is a rule about the product, not about the page.
 */

/** The two ways in, as one value: a document already in the library, or a file off the device. */
export type AtsCheckSource = { kind: 'library'; resumeId: string } | { kind: 'file'; file: JdFile };

/**
 * The document a library check would score. Nothing chosen yet means the base resume — the same
 * default the tailor intake opens with — so the page always has a target to name.
 */
export function resumeForSource(
  documents: readonly Resume[],
  source: AtsCheckSource | null,
): Resume | undefined {
  if (source?.kind === 'file') return undefined;
  const chosen = source ? documents.find((resume) => resume.id === source.resumeId) : undefined;
  return chosen ?? documents.find((resume) => resume.isBase) ?? documents[0];
}

/**
 * This month's ATS-check allowance. Both meter fields are optional on `SubscriptionUsage`, and an
 * absent cap is UNKNOWN rather than exhausted: §13.5 asks for the cap in front of the user before
 * the work, so a cap the app never read must not silently turn into a paywall. A published cap of
 * zero is a different thing — a plan that grants none is spent from the first press.
 */
export type AtsCheckAllowance = { known: boolean; used: number; limit: number; spent: boolean };

export function atsCheckAllowance(
  usage: Pick<SubscriptionUsage, 'atsChecksUsed' | 'atsChecksLimit'> | undefined,
): AtsCheckAllowance {
  const used = usage?.atsChecksUsed;
  const limit = usage?.atsChecksLimit;
  if (used === undefined || limit === undefined) {
    return { known: false, used: 0, limit: 0, spent: false };
  }
  return { known: true, used, limit, spent: used >= limit };
}

/** Header, and the three labels the primary can wear. */
export const ATS_CHECK_TITLE = 'ATS check';
export const RUN_CTA = 'Run the check';
export const OPEN_CTA = `See the ${SCORE_LABEL}`;
export const UPGRADE_CTA = 'See Pro plans';
/**
 * Not "Check a file instead": the only branch that uses this is the one where the library is
 * empty, so there is nothing for it to be instead of.
 */
export const FILE_CTA = 'Check a file from your device';
export const RUBRIC_CTA = `How the ${SCORE_LABEL} works`;

/**
 * V2 §7.8's honesty note, said in one line because this screen is where the number is bought.
 * The long form lives on the rubric screen (`SCORE_HONESTY_NOTE`); this is the same claim, not a
 * softer one — a measurement against our own rubric, and no prediction about anyone's software.
 */
export const ATS_CHECK_HONESTY_NOTE = `This ${SCORE_LABEL} measures your document against NextKin's own published rubric and nothing else. It does not predict how any employer's software will read, rank or filter your application.`;

/** What pressing the button uses up. The banner above says how many are left; this says the cost. */
export const CHECK_COST_NOTE = "Counts as one of this month's ATS checks";

/** The free path: opening a score that already exists spends nothing, whatever the quota says. */
export const SCORED_FREE_NOTE = `This document already has an ${SCORE_LABEL} — opening it doesn't use a check.`;

/** A cancelled pick and an unavailable picker are the same outcome: no file, and nothing lost. */
export const PICK_FAILED = "We didn't get a file. Pick a PDF, DOCX or TXT and we'll read it.";
export const IMPORT_FAILED = "We couldn't read that file. Check your connection and try again.";
export const CHECK_FAILED = "We couldn't start the check. Check your connection and try again.";

/** What the bar says once the allowance is gone; a plan granting none reaches this too. */
export const atsChecksSpentNote = (limit: number): string =>
  limit > 0
    ? `This month's ${pluralize(limit, 'ATS check')} are used. Pro raises the monthly cap.`
    : 'Your plan has no ATS checks this month. Pro raises the monthly cap.';

/**
 * The one line on the action bar. A failure outranks everything — it explains the press that just
 * did nothing — then the free path, then the spent cap, then the cost of the press about to
 * happen. Never the "n left this month" line: the banner above owns that, and repeating it draws
 * it twice on the page and announces it twice to a screen reader.
 */
export function atsCheckNote(input: {
  failure: string | null;
  scored: boolean;
  allowance: AtsCheckAllowance;
}): string | undefined {
  if (input.failure) return input.failure;
  if (input.scored) return SCORED_FREE_NOTE;
  if (input.allowance.spent) return atsChecksSpentNote(input.allowance.limit);
  return CHECK_COST_NOTE;
}
