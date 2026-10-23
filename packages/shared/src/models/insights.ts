/**
 * The web Insights page (Figma 461:14): how the job search is going over a window of time.
 *
 * Everything here is computed server-side from the account's own activity — jobs analyzed,
 * applications and their outcomes, the skills the saved descriptions ask for — and arrives as
 * one read. The mock returns the board's figures for the 30-day window (`toreview.md` §97).
 */

export type InsightsRange = '7d' | '30d' | '90d';

export const INSIGHTS_RANGE_LABEL: Record<InsightsRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

/** A count over the window, and its change against the window before it, in whole percent. */
export type InsightsStat = { value: number; changePct: number };

/** A share out of 100, for the skill and role bars. */
export type InsightsShare = { label: string; pct: number };

/** What an AI insight is about, which picks its glyph. */
export type InsightKind = 'match' | 'title' | 'skills' | 'pace';

export type CareerInsights = {
  range: InsightsRange;
  jobsAnalyzed: InsightsStat;
  applicationsSent: InsightsStat;
  interviews: InsightsStat;
  /** The average resume-to-job match, out of 100, and how many matches it averages. */
  resumeScore: InsightsStat & { basedOn: number };
  /** Jobs analyzed so far in the window, one point per day, oldest first. ISO dates. */
  progress: { date: string; total: number }[];
  funnel: { applications: number; shortlisted: number; interviews: number; offers: number };
  aiInsights: { kind: InsightKind; text: string }[];
  topSkills: InsightsShare[];
  targetRoles: InsightsShare[];
  recommendation: { role: string; reason: string };
};
