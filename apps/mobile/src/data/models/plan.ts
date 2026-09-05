import type { SubscriptionPlan } from './user';

/**
 * NextKin V2 spec §13.2–13.3 — plans and the Free vs Pro comparison table. No artboard exists
 * for the plan screen (plan §8, phase 9), so every number below is transcribed from §13.
 */

/**
 * The purchasable SKU. Not to be confused with `SubscriptionPlan` (./user), which is the TIER a
 * user is on: both `pro_monthly` and `pro_annual` grant the same 'pro' tier and entitlements.
 */
export type PlanId = 'free' | 'pro_monthly' | 'pro_annual';

export type Plan = {
  id: PlanId;
  /** The tier this SKU grants — what quota and gating checks read. */
  tier: SubscriptionPlan;
  name: string;
  /**
   * INR, the market these fixtures speak in. V2 §13.2 publishes USD/EUR/AUD bands and defers
   * India (§6.2), so the rupee figures are that band at purchasing-power parity, not list price.
   */
  price: { amount: number; currency: 'INR'; period: 'month' | 'year' };
  /** Short ribbon on the card, e.g. "Best value". */
  badge?: string;
  /** One line under the name — who the plan is for (V2 §13.2 "Intent"). */
  blurb: string;
};

/** One row of the comparison table (V2 §13.3). */
export type PlanFeature = {
  key: string;
  label: string;
  free: string;
  pro: string;
  /** Renders the row as a locked control on Free (V2 13.5), e.g. DOCX export. */
  lockedOnFree?: boolean;
};

/**
 * The gating table from V2 §13.3, in the order the spec lists it. Two rules the copy must not
 * break: no cap is hidden or unpublished (§13.1) — where a cell reads "unlimited" it carries the
 * spec's own published fair-use figure — and PDF export is never paywalled and never watermarked
 * on any tier (§7.12, §13.1).
 */
export const PLAN_FEATURES: readonly PlanFeature[] = [
  { key: 'generations', label: 'Resume generations', free: '3 / month', pro: '100 / month' },
  { key: 'atsReport', label: 'ATS score & report', free: 'Included', pro: 'Re-score on edit' },
  { key: 'atsChecks', label: 'Standalone ATS checks', free: '3 / month', pro: '30 / month' },
  { key: 'zeroResume', label: 'Zero Resume drafts', free: '1 / month', pro: 'Within quota' },
  { key: 'templates', label: 'Templates', free: '3 starter, ATS-safe', pro: 'Full library' },
  { key: 'exportPdf', label: 'PDF export', free: 'Clean, unlimited', pro: 'Clean, unlimited' },
  { key: 'exportTxt', label: 'TXT export', free: 'Included', pro: 'Included' },
  {
    key: 'exportDocx',
    label: 'DOCX export',
    free: 'Pro only',
    pro: 'Included',
    lockedOnFree: true,
  },
  { key: 'coverLetters', label: 'Cover letters', free: '1 / month', pro: 'Unlimited, fair use' },
  { key: 'interview', label: 'Interview Q&A', free: '1 set per resume', pro: 'Unlimited sets' },
  { key: 'assistant', label: 'AI assistant', free: 'Daily cap', pro: 'Higher cap + priority' },
  // Home ships 18 saved jobs (dashboardStatsFixture, DESIGN 2 artboard) and the job fixtures 12;
  // both predate this cap. "Up to 10" is the §13.3 number — fix the fixtures, not this row.
  { key: 'savedJobs', label: 'Saved jobs', free: 'Up to 10', pro: 'Unlimited' },
  { key: 'versions', label: 'Version history', free: 'Last 3 versions', pro: 'Last 20 versions' },
  { key: 'queuePriority', label: 'Generation queue', free: 'Standard', pro: 'Priority' },
] as const;
