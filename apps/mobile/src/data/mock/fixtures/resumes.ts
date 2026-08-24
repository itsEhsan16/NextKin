import type { AtsCheckItem, AtsScore, AtsSection, Resume, ResumeVersion } from '@/data/models';
import { atsBandFor } from '@/data/models';

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
    atsScore: 92,
    completeness: 0.45,
    validation: { timelineValid: true, atsOptimized: true, jdMatched: true },
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
    atsScore: 92,
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
    atsScore: 88,
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
    atsScore: 84,
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
    atsScore: 76,
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
    atsScore: 81,
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
    atsScore: 69,
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
    atsScore: 87,
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
    atsScore: undefined,
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

const pass = (id: string, label: string): AtsCheckItem => ({ id, label, passed: true });
const fix = (id: string, label: string): AtsCheckItem => ({
  id,
  label,
  passed: false,
  fixable: true,
});

/**
 * Checklist shape from RESUMES 04, parameterised so every scored doc gets a coherent panel.
 * The base resume below overrides this with the artboard's exact copy.
 */
function buildSections(opts: {
  contentMiss?: string;
  present: [string, string];
  missing: string[];
  portfolioMiss?: boolean;
}): AtsSection[] {
  const { contentMiss, present, missing, portfolioMiss } = opts;
  return [
    {
      key: 'content',
      label: 'Content',
      items: [
        pass('quantified', 'Quantified achievements in 3+ bullets'),
        pass('verbs', 'Action verbs open every bullet'),
        pass('summary', 'Summary under 60 words'),
        pass('pronouns', 'No first-person pronouns'),
        ...(contentMiss ? [fix('content_gap', contentMiss)] : []),
      ],
    },
    {
      key: 'format',
      label: 'Format',
      items: [
        pass('column', 'Single column — parser safe'),
        pass('headings', 'Standard section headings'),
        pass('tables', 'No tables, text boxes or images'),
      ],
    },
    {
      key: 'keywords',
      label: 'Keywords',
      items: [
        pass('kw_1', `"${present[0]}" appears 3 times`),
        pass('kw_2', `"${present[1]}" appears twice`),
        ...missing.map((keyword, index) => fix(`kw_miss_${index}`, `Missing: "${keyword}"`)),
      ],
    },
    {
      key: 'best',
      label: 'Best practices',
      items: [
        pass('contact', 'Contact details complete'),
        pass('filename', 'File name follows convention'),
        pass('pages', 'Two pages or fewer'),
        ...(portfolioMiss ? [fix('portfolio', 'Add a portfolio link')] : []),
      ],
    },
  ];
}

const summaryFor = (total: number, quickWins: number): string => {
  const band = atsBandFor(total);
  if (band === 'strong')
    return `Parsers will read this cleanly. ${quickWins} quick wins left before it is airtight.`;
  if (band === 'good') return 'Solid foundation — a few fixes will push this into the green.';
  return 'Parsers may stumble here. Start with the quick wins below.';
};

const score = (total: number, sections: AtsSection[], summary?: string): AtsScore => {
  const quickWins = sections.flatMap((s) => s.items).filter((i) => !i.passed && i.fixable).length;
  return { total, band: atsBandFor(total), summary: summary ?? summaryFor(total, quickWins), sections };
};

export const atsScoresFixture: Record<string, AtsScore> = {
  // RESUMES 04 verbatim — four quick wins across Content / Keywords / Best practices.
  res_base: score(
    92,
    buildSections({
      contentMiss: 'Add metrics to your Zoho role',
      present: ['design systems', 'user research'],
      missing: ['stakeholder management', 'A/B testing'],
      portfolioMiss: true,
    }),
    'Parsers will read this cleanly. Four quick wins left before it is airtight.',
  ),
  res_1: score(
    92,
    buildSections({ present: ['design systems', 'search'], missing: ['accessibility'] }),
  ),
  res_2: score(
    88,
    buildSections({
      present: ['design systems', 'payments'],
      missing: ['API design'],
      portfolioMiss: true,
    }),
  ),
  res_5: score(
    84,
    buildSections({
      contentMiss: 'Add metrics to your research bullets',
      present: ['user research', 'payments'],
      missing: ['checkout'],
    }),
  ),
  res_3: score(
    76,
    buildSections({
      contentMiss: 'Quantify the systems adoption you drove',
      present: ['design systems', 'tokens'],
      missing: ['governance', 'Storybook'],
      portfolioMiss: true,
    }),
  ),
  res_4: score(
    81,
    buildSections({ present: ['prototyping', 'tools'], missing: ['developer experience'] }),
  ),
  res_zoho: score(
    69,
    buildSections({
      contentMiss: 'Add metrics to your Zoho role',
      present: ['product design', 'SaaS'],
      missing: ['enterprise', 'dashboards', 'onboarding'],
      portfolioMiss: true,
    }),
  ),
  res_atlassian: score(
    87,
    buildSections({ present: ['design systems', 'collaboration'], missing: ['Jira'] }),
  ),
};
