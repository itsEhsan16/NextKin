import type { Application, Job } from '@/data/models';

import { buildJob, type JobSeed } from './jobs.build';
import { daysAgo } from './time';

const usd = (min: number, max: number) => ({ min, max, currency: 'USD', period: 'year' }) as const;
const eur = (min: number, max: number) => ({ min, max, currency: 'EUR', period: 'year' }) as const;
const aud = (min: number, max: number) => ({ min, max, currency: 'AUD', period: 'year' }) as const;

/* prettier-ignore */
const seeds: JobSeed[] = [
  // Home "Top Job Matches" cards (DESIGN 2 artboard copy).
  { id: 'job_google', title: 'Lead UX Designer', company: 'Google', companyLogoUrl: 'asset:logo-google', location: 'Mountain View, CA', remote: 'hybrid', salary: usd(185_000, 240_000), postedDaysAgo: 2, applicantsCount: 80, source: 'jsearch', tags: ['Design systems', 'Search', 'Figma'], isPick: true, match: { score: 0.98, states: 'mmmmm' } },
  { id: 'job_adobe', title: 'Sr. UX Designer', company: 'Adobe', companyLogoUrl: 'asset:logo-adobe', location: 'San Jose, CA', remote: 'hybrid', salary: usd(160_000, 200_000), postedDaysAgo: 1, applicantsCount: 60, source: 'adzuna', tags: ['Creative tools', 'Prototyping', 'Figma'], isPick: true, match: { score: 0.94, states: 'mmmmo' } },
  { id: 'job_1', title: 'Senior Product Designer', company: 'Stripe', location: 'San Francisco, CA', remote: 'hybrid', salary: usd(165_000, 210_000), postedDaysAgo: 1, source: 'adzuna', tags: ['Design systems', 'Fintech', 'Figma'], isPick: true, match: { score: 0.92, states: 'mmmmo' } },
  { id: 'job_2', title: 'Product Designer', company: 'Figma', location: 'New York, NY', remote: 'hybrid', salary: usd(140_000, 180_000), postedDaysAgo: 2, source: 'jsearch', tags: ['Collaboration', 'Prototyping', 'Tools'], isPick: true, isSaved: true, match: { score: 0.86, states: 'mmmxo' } },
  { id: 'job_3', title: 'Design Systems Engineer', company: 'Zalando', location: 'Berlin, DE', remote: 'hybrid', salary: eur(70_000, 90_000), postedDaysAgo: 3, source: 'adzuna', tags: ['Design systems', 'React', 'Storybook'], isSaved: true, match: { score: 0.64, states: 'mmxxo' } },
  { id: 'job_4', title: 'Staff Product Designer', company: 'Canva', location: 'Sydney, AU', remote: 'hybrid', salary: aud(190_000, 240_000), postedDaysAgo: 0.5, source: 'jsearch', tags: ['Creative tools', 'Mobile', 'Figma'], isPick: true, match: { score: 0.81, states: 'mmmxm' } },
  { id: 'job_5', title: 'UX Lead', company: 'Atlassian', location: 'Sydney, AU', remote: 'remote', salary: aud(170_000, 210_000), postedDaysAgo: 4, source: 'adzuna', tags: ['Leadership', 'Enterprise', 'Jira'], isSaved: true, match: { score: 0.71, states: 'mmxxm' } },
  { id: 'job_6', title: 'Product Designer', company: 'Linear', location: 'Remote (US)', remote: 'remote', salary: usd(150_000, 190_000), postedDaysAgo: 1.5, source: 'jsearch', tags: ['Tools', 'Prototyping', 'Figma'], isPick: true, match: { score: 0.88, states: 'mmmmx' } },
  { id: 'job_7', title: 'Senior UX Designer', company: 'SAP', location: 'Walldorf, DE', remote: 'onsite', salary: eur(75_000, 95_000), postedDaysAgo: 6, source: 'adzuna', tags: ['Enterprise', 'Accessibility', 'Research'], match: { score: 0.58, states: 'mxxom' } },
  { id: 'job_8', title: 'Lead Product Designer', company: 'Notion', location: 'San Francisco, CA', remote: 'hybrid', salary: usd(180_000, 230_000), postedDaysAgo: 2.5, source: 'jsearch', tags: ['Leadership', 'Design systems', 'Tools'], isSaved: true, match: { score: 0.77, states: 'mxmmo' } },
  { id: 'job_9', title: 'UI/UX Designer', company: 'Shopify', location: 'Remote (Americas)', remote: 'remote', salary: usd(120_000, 150_000), postedDaysAgo: 5, source: 'adzuna', tags: ['E-commerce', 'Mobile', 'Figma'] },
  { id: 'job_10', title: 'Product Designer', company: 'N26', location: 'Berlin, DE', remote: 'hybrid', salary: eur(65_000, 85_000), postedDaysAgo: 7, source: 'jsearch', tags: ['Fintech', 'Mobile', 'Research'] },
  { id: 'job_11', title: 'Product Designer', company: 'Afterpay', location: 'Melbourne, AU', remote: 'hybrid', salary: aud(140_000, 170_000), postedDaysAgo: 3.5, source: 'adzuna', tags: ['Fintech', 'Mobile', 'Prototyping'], isSaved: true },
  { id: 'job_12', title: 'Design Lead', company: 'Airbnb', location: 'Seattle, WA', remote: 'onsite', salary: usd(190_000, 240_000), postedDaysAgo: 8, source: 'jsearch', tags: ['Leadership', 'Travel', 'Design systems'] },
  { id: 'job_13', title: 'UX Researcher', company: 'Delivery Hero', location: 'Berlin, DE', remote: 'hybrid', salary: eur(60_000, 75_000), postedDaysAgo: 9, source: 'adzuna', tags: ['Research', 'Marketplace', 'Mobile'] },
  { id: 'job_14', title: 'Product Designer', company: 'Duolingo', location: 'Pittsburgh, PA', remote: 'onsite', salary: usd(130_000, 160_000), postedDaysAgo: 4.5, source: 'jsearch', tags: ['Education', 'Mobile', 'Gamification'] },
  { id: 'job_15', title: 'Senior UI Designer', company: 'REA Group', location: 'Melbourne, AU', remote: 'hybrid', salary: aud(150_000, 180_000), postedDaysAgo: 6.5, source: 'adzuna', tags: ['Property', 'Design systems', 'Web'] },
  { id: 'job_16', title: 'Motion Designer', company: 'Discord', location: 'Remote (US)', remote: 'remote', salary: usd(125_000, 155_000), postedDaysAgo: 2, source: 'manual', tags: ['Motion', 'Brand', 'After Effects'] },
  { id: 'job_17', title: 'Senior Product Designer', company: 'Personio', location: 'Munich, DE', remote: 'hybrid', salary: eur(80_000, 100_000), postedDaysAgo: 1, source: 'jsearch', tags: ['HR tech', 'Enterprise', 'Figma'] },
  { id: 'job_18', title: 'Design Systems Lead', company: 'GitHub', location: 'Remote (US)', remote: 'remote', salary: usd(170_000, 215_000), postedDaysAgo: 3, source: 'adzuna', tags: ['Design systems', 'Developer tools', 'Accessibility'] },
  { id: 'job_19', title: 'UX Designer', company: 'Xero', location: 'Melbourne, AU', remote: 'hybrid', salary: aud(120_000, 145_000), postedDaysAgo: 8.5, source: 'jsearch', tags: ['Fintech', 'SMB', 'Research'] },
  { id: 'job_20', title: 'Product Designer', company: 'Robinhood', location: 'Menlo Park, CA', remote: 'hybrid', salary: usd(145_000, 185_000), postedDaysAgo: 5.5, source: 'adzuna', tags: ['Fintech', 'Mobile', 'Prototyping'] },
  { id: 'job_21', title: 'Interaction Designer', company: 'BMW Group', location: 'Munich, DE', remote: 'onsite', postedDaysAgo: 9.5, source: 'manual', tags: ['Automotive', 'HMI', 'Prototyping'] },
  { id: 'job_22', title: 'Senior Product Designer', company: 'Coinbase', location: 'Remote (US)', remote: 'remote', salary: usd(160_000, 200_000), postedDaysAgo: 7.5, source: 'jsearch', tags: ['Fintech', 'Crypto', 'Mobile'] },
  { id: 'job_23', title: 'Product Design Manager', company: 'Culture Amp', location: 'Melbourne, AU', remote: 'remote', salary: aud(180_000, 220_000), postedDaysAgo: 2, source: 'adzuna', tags: ['Leadership', 'HR tech', 'Research'] },
  { id: 'job_24', title: 'Product Designer', company: 'Spotify', location: 'New York, NY', remote: 'hybrid', salary: usd(135_000, 170_000), postedDaysAgo: 0.25, source: 'jsearch', tags: ['Media', 'Mobile', 'Design systems'] },
];

export const jobsFixture: Job[] = seeds.map(buildJob);

/** RELEASE 2 (V2 §6.2) — applications are modelled now so the "Applied" tab can be wired. */
export const applicationsFixture: Application[] = [
  { id: 'app_1', jobId: 'job_2', status: 'interviewing', appliedAt: daysAgo(6), resumeId: 'res_2' },
  { id: 'app_2', jobId: 'job_5', status: 'applied', appliedAt: daysAgo(2), resumeId: 'res_4' },
  { id: 'app_3', jobId: 'job_13', status: 'rejected', appliedAt: daysAgo(8) },
];
