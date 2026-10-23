import type { Resume, ResumeVersion } from '../../models';

import { daysAgo, minutesAgo } from './time';

/** Resume currently being generated (paired with the active generation fixture). */
export const GENERATING_RESUME_ID = 'res_6';

/**
 * The document library from RESUMES 01/02, plus two docs those artboards do not draw:
 *
 * - `res_1` backs Home's "Your Resume Progress" card (DESIGN 2), whose copy — "UX Designer
 *   Resume", Google — the RESUMES artboards contradict by making "Product Designer" the newest
 *   doc. Both artboards keep their own copy: res_1 stays the most recent, so the Resumes grid
 *   shows one extra leading card the comp doesn't have. Known artboard inconsistency.
 * - `res_6` is the in-flight Canva generation Home's progress card tracks; the Resumes screen
 *   lists only finished documents, so it never appears there.
 *
 * Old ids are kept where the jobs fixtures already reference them by company
 * (res_2 → Stripe, res_3 → Freshworks, res_4 → Linear).
 */
export const resumesFixture: Resume[] = [
  {
    id: 'res_1',
    title: 'UX Designer Resume',
    docType: 'resume',
    targetCompany: 'Google',
    targetRole: 'Lead UX Designer',
    thumbnailUrl: 'asset:resume-thumb',
    createdAt: daysAgo(12),
    updatedAt: daysAgo(2),
    versionCount: 3,
    currentVersionId: 'ver_1_3',
    status: 'ready',
    linkedJobId: 'job_google',
    tags: ['Design systems', 'Search'],
  },
  {
    id: 'res_base',
    title: 'Product Designer',
    docType: 'resume',
    isBase: true,
    pageCount: 3,
    createdAt: daysAgo(40),
    updatedAt: daysAgo(2.05),
    versionCount: 5,
    currentVersionId: 'ver_base_5',
    status: 'ready',
    tags: ['Design systems', 'Product'],
  },
  {
    id: 'res_2',
    title: 'Stripe — Senior PD',
    docType: 'resume',
    targetCompany: 'Stripe',
    targetRole: 'Senior Product Designer',
    updateAvailable: true,
    createdAt: daysAgo(9),
    updatedAt: daysAgo(5),
    versionCount: 2,
    currentVersionId: 'ver_2_2',
    status: 'ready',
    linkedJobId: 'job_stripe',
    tags: ['Fintech', 'Design systems'],
  },
  {
    id: 'res_cover_stripe',
    title: 'Stripe cover letter',
    docType: 'cover_letter',
    targetCompany: 'Stripe',
    targetRole: 'Senior Product Designer',
    pageCount: 1,
    createdAt: daysAgo(6),
    updatedAt: daysAgo(5.5),
    versionCount: 1,
    currentVersionId: 'ver_cs_1',
    status: 'ready',
    linkedJobId: 'job_stripe',
    tags: ['Fintech'],
  },
  {
    id: 'res_5',
    title: 'Razorpay UX',
    docType: 'resume',
    targetCompany: 'Razorpay',
    targetRole: 'Senior UX Designer',
    createdAt: daysAgo(10),
    updatedAt: daysAgo(7),
    versionCount: 1,
    currentVersionId: 'ver_5_1',
    status: 'ready',
    linkedJobId: 'job_razorpay',
    tags: ['Fintech', 'Payments'],
  },
  {
    id: 'res_3',
    title: 'Freshworks DS Lead',
    docType: 'resume',
    targetCompany: 'Freshworks',
    targetRole: 'Design Systems Lead',
    updateAvailable: true,
    createdAt: daysAgo(16),
    updatedAt: daysAgo(14),
    versionCount: 2,
    currentVersionId: 'ver_3_2',
    status: 'ready',
    linkedJobId: 'job_freshworks',
    tags: ['Design systems', 'Leadership'],
  },
  {
    id: 'res_4',
    title: 'Linear PD',
    docType: 'resume',
    targetCompany: 'Linear',
    targetRole: 'Product Designer',
    createdAt: daysAgo(23),
    updatedAt: daysAgo(21),
    versionCount: 1,
    currentVersionId: 'ver_4_1',
    status: 'ready',
    linkedJobId: 'job_linear',
    tags: ['Tools', 'Prototyping'],
  },
  {
    id: 'res_zoho',
    title: 'Zoho Product',
    docType: 'resume',
    targetCompany: 'Zoho',
    targetRole: 'Product Designer',
    createdAt: daysAgo(34),
    updatedAt: daysAgo(32),
    versionCount: 1,
    currentVersionId: 'ver_zoho_1',
    status: 'ready',
    linkedJobId: 'job_zoho',
    tags: ['SaaS', 'Enterprise'],
  },
  {
    id: 'res_atlassian',
    title: 'Atlassian Staff PD',
    docType: 'resume',
    targetCompany: 'Atlassian',
    targetRole: 'Staff Product Designer',
    createdAt: daysAgo(38),
    // 36, not 35: exactly five weeks sits on formatRelativeTime's week/month boundary.
    updatedAt: daysAgo(36),
    versionCount: 1,
    currentVersionId: 'ver_atl_1',
    status: 'ready',
    linkedJobId: 'job_atlassian_blr',
    tags: ['Enterprise', 'Design systems'],
  },
  {
    id: GENERATING_RESUME_ID,
    title: 'Staff Product Designer — Canva',
    docType: 'resume',
    targetCompany: 'Canva',
    targetRole: 'Staff Product Designer',
    createdAt: minutesAgo(2),
    updatedAt: minutesAgo(1),
    versionCount: 1,
    currentVersionId: 'ver_6_1',
    status: 'generating',
    linkedJobId: 'job_4',
    tags: ['Creative tools'],
  },
];

const versionsFor = (resumeId: string, count: number, notes: string[]): ResumeVersion[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `ver_${resumeId.replace('res_', '')}_${index + 1}`,
    resumeId,
    version: index + 1,
    createdAt: daysAgo((count - index) * 2),
    changeNote: notes[index],
  }));

export const resumeVersionsFixture: ResumeVersion[] = [
  ...versionsFor('res_1', 3, ['Initial draft', 'Added Google keywords', 'Tightened summary']),
  ...versionsFor('res_base', 5, [
    'Initial draft',
    'Added education',
    'Skills pass',
    'Quantified bullets',
    'Refresh',
  ]),
  ...versionsFor('res_2', 2, ['Initial draft', 'Added Stripe keywords']),
  ...versionsFor('res_cover_stripe', 1, ['Initial draft']),
  ...versionsFor('res_5', 1, ['Initial draft']),
  ...versionsFor('res_3', 2, ['Initial draft', 'Systems terminology pass']),
  ...versionsFor('res_4', 1, ['Initial draft']),
  ...versionsFor('res_zoho', 1, ['Initial draft']),
  ...versionsFor('res_atlassian', 1, ['Initial draft']),
  ...versionsFor(GENERATING_RESUME_ID, 1, ['Generating…']),
];

