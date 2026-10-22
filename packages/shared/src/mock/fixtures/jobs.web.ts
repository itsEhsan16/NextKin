import type { Application, ApplicationStatus, Job } from '../../models';

import { inr, jobSeeds } from './jobs';
import { buildJob, type JobSeed } from './jobs.build';
import { daysAgo, daysFromNow } from './time';

/**
 * The web boards' jobs and applications: what the store seeds instead of `jobsFixture` and
 * `applicationsFixture` once a host calls `configureMockPlatform('web')` (`mock/platform.ts`).
 * Mobile never sees any of it.
 *
 * The listings are the shared catalogue with the Applications board (Figma 286:1234) on top: the
 * three companies the catalogue lacks and a requisition id for each of the board's eight. Google
 * keeps the redrawn Jobs cards' on-site and ₹48–62 LPA (719:19) where the Applications board says
 * hybrid and ₹35–52 LPA: one record feeds both, and the owner chose the Jobs board (2026-10-09).
 * The three go after the Jobs board's five, so its "Most relevant" list still opens with those.
 */

/**
 * The web job page's listing (724:2), verbatim: the Google role as that board writes it, with
 * the benefits, perks, industries and company facts the page draws (`toreview.md` §103).
 */
const JOB_PAGE: Record<string, Partial<Job>> = {
  job_google: {
    description:
      'Google builds products used by billions of people. This team owns end-to-end design for Search and Workspace experiences, working closely with research and engineering.',
    responsibilities: [
      'Lead the design process from discovery to delivery',
      'Collaborate with product managers, engineers and researchers',
      'Define and advocate for user-centred design principles',
      'Mentor and support junior designers',
      'Drive design systems and best practices',
    ],
    requirements: [
      '3–5 years of product or UX design experience',
      'A portfolio that shows end-to-end design work',
      'Strong Figma and prototyping skills',
      'Experience planning and running user research',
      'Clear communication with engineers and stakeholders',
    ],
    benefits: [
      'Health insurance for you and your family',
      'Learning and conference budget',
      'Wellness and parental leave programmes',
      'Employee stock plan',
    ],
    perks: ['Health insurance', 'Stock plan', 'Learning budget'],
    industries: ['Internet', 'Search', 'Cloud', 'Consumer apps'],
    companyAbout:
      'Search, Maps, Android, Workspace and Cloud — products that help billions of people find, work and create.',
    companyFounded: 1998,
    companyHeadquarters: 'Mountain View, California',
    companySize: '10,000+ employees',
    companyWebsite: 'google.com',
    applyUrl: 'https://careers.google.com',
  },
};

/** The Jobs board's five (304:2332), which already lead `jobSeeds`. */
const JOBS_BOARD = new Set([
  'job_google',
  'job_adobe',
  'job_atlassian_pd',
  'job_microsoft',
  'job_airbnb',
]);

/* prettier-ignore */
const APPLICATIONS_BOARD_SEEDS: JobSeed[] = [
  { id: 'job_spotify', title: 'Senior Product Designer', company: 'Spotify', companyLogoUrl: 'asset:logo-spotify', location: 'Bengaluru, India', remote: 'hybrid', experienceYears: { min: 5, max: 8 }, reference: 'SPO-PD-40318', salary: inr(40, 55), postedDaysAgo: 26, source: 'jsearch', tags: ['Product Design', 'Media', 'Design Systems', 'Mobile'], match: { score: 0.87, states: 'mmmxo' }, isPick: true },
  { id: 'job_notion', title: 'Product Designer', company: 'Notion', companyLogoUrl: 'asset:logo-notion', location: 'Remote', remote: 'remote', experienceYears: { min: 3, max: 6 }, reference: 'NOT-PD-11482', salary: inr(30, 42), postedDaysAgo: 27, source: 'adzuna', tags: ['Product Design', 'Tools', 'Prototyping', 'Figma'], match: { score: 0.85, states: 'mmmxo' }, isPick: true },
  // The board's "Closed" row: the deadline passed before the employer answered.
  { id: 'job_flipkart', title: 'UX Designer', company: 'Flipkart', companyLogoUrl: 'asset:logo-flipkart', location: 'Bengaluru, India', remote: 'onsite', experienceYears: { min: 2, max: 4 }, reference: 'FLK-UX-72215', salary: inr(22, 30), postedDaysAgo: 35, closingInDays: -3, source: 'jsearch', tags: ['UX Design', 'E-commerce', 'Mobile', 'Research'], match: { score: 0.83, states: 'mmmxo' } },
];

/* prettier-ignore */
const OVERRIDES: Record<string, Partial<JobSeed>> = {
  // Figma 286:1608, 286:1624 and 286:1632. The other four ids are ours, in the same shape. The
  // match reasons are the redrawn job cards' (719:36, 84, 128, 175 and 217). The Jobs board's
  // other three, with Spotify and Notion, are also Home's picks, so its carousel has a card for
  // each of its eleven characters (`toreview.md` §101).
  job_google: { reference: 'GOO-UX-10234', matchReason: 'Matches your UX research and design systems experience' },
  job_adobe: { reference: 'ADB-UX-20871', matchReason: 'Matches your design systems work and remote preference' },
  job_atlassian_pd: { isPick: true, reference: 'ATL-PD-31542', matchReason: 'Matches your product design and prototyping skills' },
  job_microsoft: { isPick: true, reference: 'MSF-UX-44019', matchReason: 'Matches your interaction design skills; this role is on-site' },
  job_airbnb: { isPick: true, reference: 'ABN-PD-57230', matchReason: 'Matches your product design skills and remote preference' },
};

type ApplicationSeed = {
  jobId: string;
  status: ApplicationStatus;
  appliedDaysAgo: number;
  interviewInDays?: number;
  resumeId?: string;
};

/**
 * All 24 behind the board's "All (24)". The first eight are its rows (286:1312-1521), newest
 * first, as its "Most recent" sort draws them. The other sixteen are older, and split so the
 * status pills read as drawn: In Review 5, Interview 3, Offer 1, Rejected 4, Withdrawn 1, and ten
 * more (Screening, Applied, Closed) that only All counts. The board's "Screening" is `viewed`.
 * The resumes sent are the Resumes board's (`resumes.web.ts`): the software engineer's, tailored
 * for product design roles, to the recent design roles, and the Product Designer one before that.
 */
/* prettier-ignore */
const APPLICATIONS: ApplicationSeed[] = [
  { jobId: 'job_google', status: 'in_review', appliedDaysAgo: 2, resumeId: 'res_swe' },
  { jobId: 'job_adobe', status: 'interview', appliedDaysAgo: 7, interviewInDays: 3, resumeId: 'res_swe' },
  { jobId: 'job_atlassian_pd', status: 'viewed', appliedDaysAgo: 8, resumeId: 'res_swe' },
  { jobId: 'job_microsoft', status: 'offer', appliedDaysAgo: 14, resumeId: 'res_swe' },
  { jobId: 'job_airbnb', status: 'not_selected', appliedDaysAgo: 15 },
  { jobId: 'job_spotify', status: 'withdrawn', appliedDaysAgo: 21 },
  { jobId: 'job_notion', status: 'in_review', appliedDaysAgo: 22, resumeId: 'res_swe' },
  { jobId: 'job_flipkart', status: 'applied', appliedDaysAgo: 28 },
  { jobId: 'job_stripe', status: 'in_review', appliedDaysAgo: 31, resumeId: 'res_pd' },
  { jobId: 'job_linear', status: 'interview', appliedDaysAgo: 33, interviewInDays: 6, resumeId: 'res_pd' },
  { jobId: 'job_freshworks', status: 'viewed', appliedDaysAgo: 36, resumeId: 'res_pd' },
  { jobId: 'job_6', status: 'applied', appliedDaysAgo: 38 },
  { jobId: 'job_razorpay', status: 'in_review', appliedDaysAgo: 40, resumeId: 'res_pd' },
  { jobId: 'job_atlassian_blr', status: 'viewed', appliedDaysAgo: 43 },
  { jobId: 'job_postman', status: 'interview', appliedDaysAgo: 45, interviewInDays: 9 },
  { jobId: 'job_8', status: 'applied', appliedDaysAgo: 48 },
  { jobId: 'job_cred', status: 'not_selected', appliedDaysAgo: 50 },
  { jobId: 'job_2', status: 'viewed', appliedDaysAgo: 53 },
  { jobId: 'job_24', status: 'applied', appliedDaysAgo: 55 },
  { jobId: 'job_18', status: 'in_review', appliedDaysAgo: 58 },
  { jobId: 'job_4', status: 'viewed', appliedDaysAgo: 60 },
  { jobId: 'job_zoho', status: 'not_selected', appliedDaysAgo: 64 },
  { jobId: 'job_17', status: 'applied', appliedDaysAgo: 70 },
  { jobId: 'job_1', status: 'not_selected', appliedDaysAgo: 75 },
];

const appliedDaysAgo = new Map(APPLICATIONS.map((seed) => [seed.jobId, seed.appliedDaysAgo]));

/**
 * No one applies to a listing before it is posted, so each catalogue listing behind an
 * application is posted a couple of days before it. The Jobs board's five keep the ages that
 * board draws, though they are younger than the Applications board's (`toreview.md` §17).
 */
function forWeb(seed: JobSeed): JobSeed {
  const withBoards = { ...seed, ...OVERRIDES[seed.id] };
  const applied = appliedDaysAgo.get(seed.id);
  if (applied == null || JOBS_BOARD.has(seed.id)) return withBoards;
  return {
    ...withBoards,
    postedDaysAgo: Math.max(seed.postedDaysAgo, applied + 2),
  };
}

export const webJobsFixture: Job[] = [
  ...jobSeeds.filter((seed) => JOBS_BOARD.has(seed.id)),
  ...APPLICATIONS_BOARD_SEEDS,
  ...jobSeeds.filter((seed) => !JOBS_BOARD.has(seed.id)),
]
  .map(forWeb)
  .map((seed, index) => buildJob(seed, index))
  .map((job) => ({ ...job, ...JOB_PAGE[job.id] }));

export const webApplicationsFixture: Application[] = APPLICATIONS.map((seed) => ({
  id: `app_web_${seed.jobId.replace(/^job_/, '')}`,
  jobId: seed.jobId,
  status: seed.status,
  appliedAt: daysAgo(seed.appliedDaysAgo),
  ...(seed.interviewInDays != null ? { interviewAt: daysFromNow(seed.interviewInDays) } : {}),
  ...(seed.resumeId ? { resumeId: seed.resumeId } : {}),
}));
