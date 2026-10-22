import type { CareerInsights, InsightsRange, InsightsShare } from '../../models/insights';

import { daysAgo } from './time';

/** A cumulative series ending today: `totals[i]` is the count by the i-th of the last n days. */
const series = (totals: number[]) =>
  totals.map((total, index) => ({ date: daysAgo(totals.length - 1 - index), total }));

/** The board's curve (462:23): a quick start, a long plateau, then a climb in the last week. */
const MONTH = [
  0, 2, 4, 6, 7, 8, 8, 9, 9, 9, 10, 10, 10, 10, 11, 11, 12, 13, 13, 13, 14, 14, 15, 17, 17, 17, 19,
  21, 22, 24,
];

const QUARTER = Array.from({ length: 90 }, (_, day) => Math.round(58 * (day / 89) ** 1.15));

const AI_INSIGHTS: CareerInsights['aiInsights'] = [
  {
    kind: 'match',
    text: "You're 40% more likely to get an interview when your resume matches 80%+ of JD skills.",
  },
  {
    kind: 'title',
    text: 'Roles with “UX Research” in the title have the highest response rate for you.',
  },
  { kind: 'skills', text: 'You often miss key skills like “user testing” and “design systems”.' },
  { kind: 'pace', text: 'Your application rate is above average! Keep it up!' },
];

const TOP_SKILLS: InsightsShare[] = [
  { label: 'Figma', pct: 92 },
  { label: 'User Research', pct: 76 },
  { label: 'Interaction Design', pct: 68 },
  { label: 'Wireframing', pct: 64 },
  { label: 'Design Systems', pct: 60 },
];

const TARGET_ROLES: InsightsShare[] = [
  { label: 'Product Designer', pct: 42 },
  { label: 'UX Designer', pct: 28 },
  { label: 'UI Designer', pct: 18 },
  { label: 'Product Researcher', pct: 8 },
  { label: 'Other', pct: 4 },
];

const RECOMMENDATION: CareerInsights['recommendation'] = {
  role: 'Product Designer',
  reason:
    'Based on your skills, recent activity, and market trends, Product Designer roles have the highest match potential for you.',
};

const shared = {
  aiInsights: AI_INSIGHTS,
  topSkills: TOP_SKILLS,
  targetRoles: TARGET_ROLES,
  recommendation: RECOMMENDATION,
};

/**
 * Insights for each window (461:14). The 30-day one is the board's, figure for figure; the 7- and
 * 90-day ones are the same account seen over a shorter and a longer stretch.
 */
export const insightsFixture: Record<InsightsRange, CareerInsights> = {
  '7d': {
    range: '7d',
    jobsAnalyzed: { value: 7, changePct: 17 },
    applicationsSent: { value: 3, changePct: 50 },
    interviews: { value: 1, changePct: 0 },
    resumeScore: { value: 78, changePct: 4, basedOn: 4 },
    progress: series(MONTH.slice(-7).map((total) => total - 17)),
    funnel: { applications: 3, shortlisted: 2, interviews: 1, offers: 0 },
    ...shared,
  },
  '30d': {
    range: '30d',
    jobsAnalyzed: { value: 24, changePct: 20 },
    applicationsSent: { value: 12, changePct: 33 },
    interviews: { value: 3, changePct: 200 },
    resumeScore: { value: 78, changePct: 12, basedOn: 10 },
    progress: series(MONTH),
    funnel: { applications: 12, shortlisted: 6, interviews: 3, offers: 1 },
    ...shared,
  },
  '90d': {
    range: '90d',
    jobsAnalyzed: { value: 58, changePct: 45 },
    applicationsSent: { value: 31, changePct: 29 },
    interviews: { value: 6, changePct: 100 },
    resumeScore: { value: 76, changePct: 9, basedOn: 26 },
    progress: series(QUARTER),
    funnel: { applications: 31, shortlisted: 14, interviews: 6, offers: 2 },
    ...shared,
  },
};
