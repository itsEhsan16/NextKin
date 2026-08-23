import type { AtsScore, Resume, ResumeVersion } from '@/data/models';
import { atsBandFor } from '@/data/models';

import { daysAgo, hoursAgo, minutesAgo } from './time';

/** Resume currently being generated (paired with the active generation fixture). */
export const GENERATING_RESUME_ID = 'res_6';

export const resumesFixture: Resume[] = [
  {
    id: 'res_1',
    title: 'Senior Product Designer — Stripe',
    targetCompany: 'Stripe',
    targetRole: 'Senior Product Designer',
    createdAt: daysAgo(12),
    updatedAt: hoursAgo(5),
    versionCount: 3,
    currentVersionId: 'ver_1_3',
    atsScore: 91,
    status: 'ready',
    linkedJobId: 'job_1',
    tags: ['Fintech', 'Design systems'],
  },
  {
    id: 'res_2',
    title: 'Product Designer — Figma',
    targetCompany: 'Figma',
    targetRole: 'Product Designer',
    createdAt: daysAgo(9),
    updatedAt: daysAgo(1),
    versionCount: 2,
    currentVersionId: 'ver_2_2',
    atsScore: 84,
    status: 'ready',
    linkedJobId: 'job_2',
    tags: ['Tools', 'Collaboration'],
  },
  {
    id: 'res_3',
    title: 'General — Product Design',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(3),
    versionCount: 5,
    currentVersionId: 'ver_3_5',
    atsScore: 76,
    status: 'ready',
    tags: ['General'],
  },
  {
    id: 'res_4',
    title: 'UX Lead — Atlassian',
    targetCompany: 'Atlassian',
    targetRole: 'UX Lead',
    createdAt: daysAgo(6),
    updatedAt: daysAgo(2),
    versionCount: 1,
    currentVersionId: 'ver_4_1',
    atsScore: 68,
    status: 'ready',
    linkedJobId: 'job_5',
    tags: ['Leadership', 'Enterprise'],
  },
  {
    id: 'res_5',
    title: 'Design Systems Engineer — Zalando',
    targetCompany: 'Zalando',
    targetRole: 'Design Systems Engineer',
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4),
    versionCount: 1,
    currentVersionId: 'ver_5_1',
    atsScore: 61,
    status: 'ready',
    linkedJobId: 'job_3',
    tags: ['Design systems', 'Front-end'],
  },
  {
    id: GENERATING_RESUME_ID,
    title: 'Staff Product Designer — Canva',
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
  ...versionsFor('res_1', 3, ['Initial draft', 'Added Stripe keywords', 'Tightened summary']),
  ...versionsFor('res_2', 2, ['Initial draft', 'Reordered experience']),
  ...versionsFor('res_3', 5, [
    'Initial draft',
    'Added education',
    'Skills pass',
    'Typos',
    'Refresh',
  ]),
  ...versionsFor('res_4', 1, ['Initial draft']),
  ...versionsFor('res_5', 1, ['Initial draft']),
  ...versionsFor(GENERATING_RESUME_ID, 1, ['Generating…']),
];

const buildScore = (
  total: number,
  matched: string[],
  missing: string[],
  suggestions: AtsScore['suggestions'],
): AtsScore => {
  const weight = total / 100;
  return {
    total,
    band: atsBandFor(total),
    breakdown: [
      { key: 'keywords', label: 'Keywords', score: Math.round(40 * weight), max: 40 },
      { key: 'format', label: 'Formatting', score: Math.round(20 * weight), max: 20 },
      { key: 'experience', label: 'Experience match', score: Math.round(25 * weight), max: 25 },
      {
        key: 'readability',
        label: 'Readability',
        score: Math.round(15 * weight),
        max: 15,
        hint: 'Short bullet points score best',
      },
    ],
    matchedKeywords: matched,
    missingKeywords: missing,
    suggestions,
  };
};

export const atsScoresFixture: Record<string, AtsScore> = {
  res_1: buildScore(
    91,
    ['Design systems', 'Figma', 'Prototyping', 'Accessibility', 'Payments'],
    ['Motion design'],
    [{ id: 'sug_1_1', text: 'Mention motion design work on checkout flows', impact: 'low' }],
  ),
  res_2: buildScore(
    84,
    ['Figma', 'Collaboration', 'Prototyping', 'User research'],
    ['Plugin development', 'Multiplayer'],
    [
      {
        id: 'sug_2_1',
        text: 'Add a bullet about real-time collaboration features',
        impact: 'medium',
      },
      { id: 'sug_2_2', text: 'Quantify research impact with a metric', impact: 'low' },
    ],
  ),
  res_3: buildScore(
    76,
    ['Product design', 'Prototyping', 'User research'],
    ['Design systems', 'Accessibility', 'Metrics'],
    [
      { id: 'sug_3_1', text: 'Name the design system you maintained', impact: 'high' },
      { id: 'sug_3_2', text: 'Add accessibility (WCAG) experience', impact: 'medium' },
    ],
  ),
  res_4: buildScore(
    68,
    ['Leadership', 'Mentoring', 'Enterprise'],
    ['Jira', 'Roadmapping', 'Stakeholder management', 'Hiring'],
    [
      { id: 'sug_4_1', text: 'Describe team size and hiring you led', impact: 'high' },
      { id: 'sug_4_2', text: 'Reference Atlassian products you have used', impact: 'medium' },
    ],
  ),
  res_5: buildScore(
    61,
    ['Design systems', 'Figma', 'Tokens'],
    ['React', 'TypeScript', 'Storybook', 'CSS-in-JS', 'Testing'],
    [
      { id: 'sug_5_1', text: 'Add front-end implementation experience (React)', impact: 'high' },
      { id: 'sug_5_2', text: 'Mention Storybook or component documentation', impact: 'high' },
      {
        id: 'sug_5_3',
        text: 'List token tooling (Style Dictionary, Tokens Studio)',
        impact: 'medium',
      },
    ],
  ),
};
