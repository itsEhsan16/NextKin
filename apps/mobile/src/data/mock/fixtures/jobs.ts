import type { Application, Job } from '@/data/models';

import { buildJob, type JobSeed } from './jobs.build';
import { daysAgo, daysFromNow } from './time';

const usd = (min: number, max: number) => ({ min, max, currency: 'USD', period: 'year' }) as const;
const eur = (min: number, max: number) => ({ min, max, currency: 'EUR', period: 'year' }) as const;
const aud = (min: number, max: number) => ({ min, max, currency: 'AUD', period: 'year' }) as const;
/** Indian listings quote lakh; `est` renders the artboard's "· est." suffix. */
const inr = (min: number, max: number, est = false) =>
  ({ min: min * 100_000, max: max * 100_000, currency: 'INR', period: 'year', estimated: est }) as const;

/* prettier-ignore */
const seeds: JobSeed[] = [
  // --- Jobs tab artboards (JOBS 01-03). Seed order is the "Relevance" order on screen. ---
  // "Today's picks" carousel (Figma 1:301 / 1:313).
  { id: 'job_stripe', title: 'Senior Product Designer', company: 'Stripe', location: 'Bengaluru', remote: 'remote', salary: inr(28, 38, true), postedDaysAgo: 1, source: 'adzuna', tags: ['Fintech', 'Design systems', 'Figma'], isTodaysPick: true, isSaved: true, savedDaysAgo: 0.5, closingInDays: 3, match: { score: 0.91, states: 'mmmmo' } },
  { id: 'job_linear', title: 'Product Designer', company: 'Linear', location: 'Remote (India)', remote: 'remote', salary: inr(32, 42), postedDaysAgo: 2, source: 'jsearch', tags: ['Tools', 'Prototyping', 'Figma'], isTodaysPick: true, isSaved: true, savedDaysAgo: 2, match: { score: 0.88, states: 'mmmmx' } },
  // "All jobs" list (Figma 1:329 / 1:343 / 1:357 / 1:371).
  { id: 'job_razorpay', title: 'Senior UX Designer', company: 'Razorpay', location: 'Bengaluru', remote: 'hybrid', salary: inr(24, 32, true), postedDaysAgo: 2, source: 'adzuna', tags: ['Fintech', 'Payments', 'Research'], isSaved: true, savedDaysAgo: 4, match: { score: 0.86, states: 'mmmxo' } },
  { id: 'job_zoho', title: 'Product Designer', company: 'Zoho', location: 'Chennai', remote: 'onsite', salary: inr(18, 24, true), postedDaysAgo: 4, source: 'jsearch', tags: ['SaaS', 'Enterprise', 'Web'], match: { score: 0.68, states: 'mmxxo' } },
  { id: 'job_freshworks', title: 'Design Systems Lead', company: 'Freshworks', location: 'Bengaluru', remote: 'hybrid', salary: inr(38, 48), postedDaysAgo: 7, source: 'adzuna', tags: ['Design systems', 'SaaS', 'Leadership'], isSaved: true, savedDaysAgo: 7, match: { score: 0.72, states: 'mmxmo' } },
  { id: 'job_atlassian_blr', title: 'Staff Product Designer', company: 'Atlassian', location: 'Bengaluru', remote: 'hybrid', salary: inr(45, 60), postedDaysAgo: 9, source: 'adzuna', tags: ['Enterprise', 'Collaboration', 'Design systems'], isSaved: true, savedDaysAgo: 8, match: { score: 0.7, states: 'mmxxo' } },
  { id: 'job_postman', title: 'Product Designer, Growth', company: 'Postman', location: 'Bengaluru', remote: 'remote', salary: inr(26, 34, true), postedDaysAgo: 14, source: 'jsearch', tags: ['Developer tools', 'Growth', 'Experimentation'], isSaved: true, savedDaysAgo: 15, match: { score: 0.83, states: 'mmmxo' } },
  { id: 'job_cred', title: 'Senior Interaction Designer', company: 'CRED', location: 'Bengaluru', remote: 'onsite', salary: inr(30, 40, true), postedDaysAgo: 3, source: 'jsearch', tags: ['Fintech', 'Motion', 'Mobile'], match: { score: 0.84, states: 'mmmmo' } },
  // Home "Top Job Matches" cards (DESIGN 2 artboard copy).
  { id: 'job_google', title: 'Lead UX Designer', company: 'Google', companyLogoUrl: 'asset:logo-google', location: 'Mountain View, CA', remote: 'hybrid', salary: usd(185_000, 240_000), postedDaysAgo: 2, applicantsCount: 80, source: 'jsearch', tags: ['Design systems', 'Search', 'Figma'], isPick: true, match: { score: 0.98, states: 'mmmmm' } },
  { id: 'job_adobe', title: 'Sr. UX Designer', company: 'Adobe', companyLogoUrl: 'asset:logo-adobe', location: 'San Jose, CA', remote: 'hybrid', salary: usd(160_000, 200_000), postedDaysAgo: 1, applicantsCount: 60, source: 'adzuna', tags: ['Creative tools', 'Prototyping', 'Figma'], isPick: true, match: { score: 0.94, states: 'mmmmo' } },
  { id: 'job_1', title: 'Senior Product Designer', company: 'Stripe', location: 'San Francisco, CA', remote: 'hybrid', salary: usd(165_000, 210_000), postedDaysAgo: 1, source: 'adzuna', tags: ['Design systems', 'Fintech', 'Figma'], isPick: true, match: { score: 0.92, states: 'mmmmo' } },
  { id: 'job_2', isSaved: true, savedDaysAgo: 18, title: 'Product Designer', company: 'Figma', location: 'New York, NY', remote: 'hybrid', salary: usd(140_000, 180_000), postedDaysAgo: 2, source: 'jsearch', tags: ['Collaboration', 'Prototyping', 'Tools'], isPick: true, match: { score: 0.86, states: 'mmmxo' } },
  { id: 'job_3', isSaved: true, savedDaysAgo: 22, title: 'Design Systems Engineer', company: 'Zalando', location: 'Berlin, DE', remote: 'hybrid', salary: eur(70_000, 90_000), postedDaysAgo: 3, source: 'adzuna', tags: ['Design systems', 'React', 'Storybook'], match: { score: 0.64, states: 'mmxxo' } },
  { id: 'job_4', title: 'Staff Product Designer', company: 'Canva', location: 'Sydney, AU', remote: 'hybrid', salary: aud(190_000, 240_000), postedDaysAgo: 0.5, source: 'jsearch', tags: ['Creative tools', 'Mobile', 'Figma'], isPick: true, match: { score: 0.81, states: 'mmmxm' } },
  { id: 'job_5', isSaved: true, savedDaysAgo: 26, title: 'UX Lead', company: 'Atlassian', location: 'Sydney, AU', remote: 'remote', salary: aud(170_000, 210_000), postedDaysAgo: 4, source: 'adzuna', tags: ['Leadership', 'Enterprise', 'Jira'], match: { score: 0.71, states: 'mmxxm' } },
  { id: 'job_6', title: 'Product Designer', company: 'Linear', location: 'Remote (US)', remote: 'remote', salary: usd(150_000, 190_000), postedDaysAgo: 1.5, source: 'jsearch', tags: ['Tools', 'Prototyping', 'Figma'], isPick: true, match: { score: 0.88, states: 'mmmmx' } },
  { id: 'job_7', title: 'Senior UX Designer', company: 'SAP', location: 'Walldorf, DE', remote: 'onsite', salary: eur(75_000, 95_000), postedDaysAgo: 6, source: 'adzuna', tags: ['Enterprise', 'Accessibility', 'Research'], match: { score: 0.58, states: 'mxxom' } },
  { id: 'job_8', isSaved: true, savedDaysAgo: 30, title: 'Lead Product Designer', company: 'Notion', location: 'San Francisco, CA', remote: 'hybrid', salary: usd(180_000, 230_000), postedDaysAgo: 2.5, source: 'jsearch', tags: ['Leadership', 'Design systems', 'Tools'], match: { score: 0.77, states: 'mxmmo' } },
  { id: 'job_9', title: 'UI/UX Designer', company: 'Shopify', location: 'Remote (Americas)', remote: 'remote', salary: usd(120_000, 150_000), postedDaysAgo: 5, source: 'adzuna', tags: ['E-commerce', 'Mobile', 'Figma'] },
  { id: 'job_10', title: 'Product Designer', company: 'N26', location: 'Berlin, DE', remote: 'hybrid', salary: eur(65_000, 85_000), postedDaysAgo: 7, source: 'jsearch', tags: ['Fintech', 'Mobile', 'Research'] },
  { id: 'job_11', isSaved: true, savedDaysAgo: 34, title: 'Product Designer', company: 'Afterpay', location: 'Melbourne, AU', remote: 'hybrid', salary: aud(140_000, 170_000), postedDaysAgo: 3.5, source: 'adzuna', tags: ['Fintech', 'Mobile', 'Prototyping'] },
  { id: 'job_12', title: 'Design Lead', company: 'Airbnb', location: 'Seattle, WA', remote: 'onsite', salary: usd(190_000, 240_000), postedDaysAgo: 8, source: 'jsearch', tags: ['Leadership', 'Travel', 'Design systems'] },
  { id: 'job_13', title: 'UX Researcher', company: 'Delivery Hero', location: 'Berlin, DE', remote: 'hybrid', salary: eur(60_000, 75_000), postedDaysAgo: 9, source: 'adzuna', tags: ['Research', 'Marketplace', 'Mobile'] },
  { id: 'job_14', title: 'Product Designer', company: 'Duolingo', location: 'Pittsburgh, PA', remote: 'onsite', salary: usd(130_000, 160_000), postedDaysAgo: 4.5, source: 'jsearch', tags: ['Education', 'Mobile', 'Gamification'] },
  { id: 'job_15', title: 'Senior UI Designer', company: 'REA Group', location: 'Melbourne, AU', remote: 'hybrid', salary: aud(150_000, 180_000), postedDaysAgo: 6.5, source: 'adzuna', tags: ['Property', 'Design systems', 'Web'] },
  { id: 'job_16', title: 'Motion Designer', company: 'Discord', location: 'Remote (US)', remote: 'remote', salary: usd(125_000, 155_000), postedDaysAgo: 2, source: 'manual', tags: ['Motion', 'Brand', 'After Effects'] },
  { id: 'job_17', title: 'Senior Product Designer', company: 'Personio', location: 'Munich, DE', remote: 'hybrid', salary: eur(80_000, 100_000), postedDaysAgo: 1, source: 'jsearch', tags: ['HR tech', 'Enterprise', 'Figma'] },
  { id: 'job_18', isSaved: true, savedDaysAgo: 20, title: 'Design Systems Lead', company: 'GitHub', location: 'Remote (US)', remote: 'remote', salary: usd(170_000, 215_000), postedDaysAgo: 3, source: 'adzuna', tags: ['Design systems', 'Developer tools', 'Accessibility'] },
  { id: 'job_19', title: 'UX Designer', company: 'Xero', location: 'Melbourne, AU', remote: 'hybrid', salary: aud(120_000, 145_000), postedDaysAgo: 8.5, source: 'jsearch', tags: ['Fintech', 'SMB', 'Research'] },
  { id: 'job_20', title: 'Product Designer', company: 'Robinhood', location: 'Menlo Park, CA', remote: 'hybrid', salary: usd(145_000, 185_000), postedDaysAgo: 5.5, source: 'adzuna', tags: ['Fintech', 'Mobile', 'Prototyping'] },
  { id: 'job_21', title: 'Interaction Designer', company: 'BMW Group', location: 'Munich, DE', remote: 'onsite', postedDaysAgo: 9.5, source: 'manual', tags: ['Automotive', 'HMI', 'Prototyping'] },
  { id: 'job_22', title: 'Senior Product Designer', company: 'Coinbase', location: 'Remote (US)', remote: 'remote', salary: usd(160_000, 200_000), postedDaysAgo: 7.5, source: 'jsearch', tags: ['Fintech', 'Crypto', 'Mobile'] },
  { id: 'job_23', title: 'Product Design Manager', company: 'Culture Amp', location: 'Melbourne, AU', remote: 'remote', salary: aud(180_000, 220_000), postedDaysAgo: 2, source: 'adzuna', tags: ['Leadership', 'HR tech', 'Research'] },
  { id: 'job_24', title: 'Product Designer', company: 'Spotify', location: 'New York, NY', remote: 'hybrid', salary: usd(135_000, 170_000), postedDaysAgo: 0.25, source: 'jsearch', tags: ['Media', 'Mobile', 'Design systems'] },
];

export const jobsFixture: Job[] = seeds.map((seed, index) => buildJob(seed, index));

/**
 * RELEASE 2 (V2 §6.2) — application tracking is modelled now so the Applied tab can be wired.
 * Declaration order IS the order the artboard lists them (JOBS 03), leading with the actionable
 * interview rather than the newest submission; the repo preserves it.
 */
export const applicationsFixture: Application[] = [
  { id: 'app_razorpay', jobId: 'job_razorpay', status: 'interview', appliedAt: daysAgo(12), interviewAt: daysFromNow(4), resumeId: 'res_1' },
  { id: 'app_stripe', jobId: 'job_stripe', status: 'viewed', appliedAt: daysAgo(5), resumeId: 'res_2' },
  { id: 'app_freshworks', jobId: 'job_freshworks', status: 'in_review', appliedAt: daysAgo(8), resumeId: 'res_3' },
  { id: 'app_zoho', jobId: 'job_zoho', status: 'applied', appliedAt: daysAgo(2) },
  { id: 'app_cred', jobId: 'job_cred', status: 'not_selected', appliedAt: daysAgo(21) },
  { id: 'app_linear', jobId: 'job_linear', status: 'viewed', appliedAt: daysAgo(3), resumeId: 'res_4' },
  { id: 'app_atlassian', jobId: 'job_atlassian_blr', status: 'in_review', appliedAt: daysAgo(15) },
  { id: 'app_postman', jobId: 'job_postman', status: 'applied', appliedAt: daysAgo(9) },
  { id: 'app_figma', jobId: 'job_2', status: 'interview', appliedAt: daysAgo(19), interviewAt: daysFromNow(9), resumeId: 'res_2' },
  { id: 'app_notion', jobId: 'job_8', status: 'not_selected', appliedAt: daysAgo(27) },
  { id: 'app_github', jobId: 'job_18', status: 'viewed', appliedAt: daysAgo(6) },
  { id: 'app_zalando', jobId: 'job_3', status: 'withdrawn', appliedAt: daysAgo(24) },
];
