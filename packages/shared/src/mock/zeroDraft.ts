import type { ContentEducation, ContentRole, ResumeContent, ZeroSeed, ZeroYears } from '../models';
import { formatZeroPeriod, ZERO_YEARS_LABEL } from '../models';

import { COMPANY_PLACEHOLDER } from './documentCopy';

/**
 * The mock behind Zero Resume Mode (V2 §7.9, toreview §72): a first draft from a name, a years
 * band and the role you want. A real backend replaces this file; screens read only the
 * `ResumeContent` it returns and its `review` checklist.
 *
 * What it may guess, it flags: each role with its dates, each skill claim, the education entry.
 * What it cannot know stays a bracketed blank — the company and the school (§7.9's placeholder
 * policy). The summary says only what the user told us, so it needs no check of its own.
 */

/** ZERO 03 draws "[Degree] · [Institution]" (613:412). */
export const DEGREE_PLACEHOLDER = '[Degree]';
export const ZERO_INSTITUTION_PLACEHOLDER = '[Institution]';

const SENIORITY = /^(junior|associate|senior|sr\.?|lead|principal|staff|head of)\s+/i;

/** "Senior Product Designer" → "Product Designer": the ladder below is built on the bare role. */
const bareRole = (title: string): string => title.trim().replace(SENIORITY, '').trim();

/** Each band's roles, newest first: how many years before now each started and ended. */
const SPANS: Record<ZeroYears, readonly (readonly [number, number | 'present'])[]> = {
  none: [],
  '1-2': [[2, 'present']],
  '3-5': [
    [2, 'present'],
    [4, 2],
  ],
  // ZERO 03 at 2026: "2021 – Present" and "2017 – 2021" (613:399, 613:406).
  '6-10': [
    [5, 'present'],
    [9, 5],
    [10, 9],
  ],
  '10+': [
    [5, 'present'],
    [9, 5],
    [12, 9],
  ],
};

/** The plausible titles for each band, newest first (V2 §7.9's "plausible titles"). */
function ladder(role: string, band: ZeroYears): string[] {
  switch (band) {
    case 'none':
      return [];
    case '1-2':
      return [role];
    case '3-5':
      return [role, `Junior ${role}`];
    case '6-10':
      return [`Senior ${role}`, role, `Junior ${role}`];
    case '10+':
      return [`Lead ${role}`, `Senior ${role}`, role];
  }
}

type Family = { match: RegExp; bullet: string; skills: [string, string] };

/**
 * What a role of each kind usually does and uses. One generic line per role, flagged with the
 * role, so the user confirms or rewrites it with the title — never a named product or a number.
 */
const FAMILIES: readonly Family[] = [
  {
    match: /design/i,
    bullet: 'Designed product flows with engineering and product teams',
    skills: ['Figma', 'Prototyping'],
  },
  {
    match: /engineer|developer|programmer/i,
    bullet: 'Built and shipped features with product and design teams',
    skills: ['JavaScript', 'Git'],
  },
  {
    match: /product manager|product owner/i,
    bullet: 'Planned the roadmap and worked with design and engineering to ship it',
    skills: ['Roadmapping', 'User research'],
  },
  {
    match: /analyst|data/i,
    bullet: 'Turned data into reports the team used to decide',
    skills: ['SQL', 'Excel'],
  },
  {
    match: /market/i,
    bullet: 'Planned and ran campaigns across channels',
    skills: ['Content marketing', 'Analytics'],
  },
  {
    match: /sales|account/i,
    bullet: 'Looked after a pipeline of customer accounts',
    skills: ['CRM', 'Negotiation'],
  },
];

const FALLBACK: Family = {
  match: /.*/,
  bullet: 'Did the day-to-day work of the role with the team',
  skills: ['Communication', 'Teamwork'],
};

const familyOf = (role: string): Family => FAMILIES.find((f) => f.match.test(role)) ?? FALLBACK;

/** The band a bare figure falls in, for a seed that predates the bands. */
export function zeroBandFor(years: number): ZeroYears {
  if (years <= 0) return 'none';
  if (years <= 2) return '1-2';
  if (years <= 5) return '3-5';
  if (years <= 10) return '6-10';
  return '10+';
}

const sentenceCase = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

export function buildZeroDraft(opts: {
  resumeId: string;
  versionId: string;
  seed: ZeroSeed;
  /** Today's year; the spans count back from it. */
  year: number;
}): ResumeContent {
  const { resumeId, versionId, seed, year } = opts;
  const band = seed.yearsBand ?? zeroBandFor(seed.yearsExperience);
  const role = bareRole(seed.targetTitle ?? '') || 'Professional';
  const family = familyOf(role);
  const titles = ladder(role, band);
  const spans = SPANS[band];

  const experience: ContentRole[] = titles.map((title, index) => {
    const [from, to] = spans[index] ?? [0, 'present'];
    return {
      id: `${resumeId}_role_${index + 1}`,
      title,
      company: COMPANY_PLACEHOLDER,
      period: formatZeroPeriod(
        { year: year - from },
        to === 'present' ? 'present' : { year: year - to },
      ),
      bullets: [family.bullet],
      needsReview: true,
    };
  });

  // School ends where the first job starts; someone starting out is finishing about now.
  const finished = year - (spans[spans.length - 1]?.[0] ?? 0);
  const education: ContentEducation[] = [
    {
      id: `${resumeId}_edu_1`,
      degree: DEGREE_PLACEHOLDER,
      institution: ZERO_INSTITUTION_PLACEHOLDER,
      period: formatZeroPeriod({ year: finished - 4 }, { year: finished }),
      needsReview: true,
    },
  ];

  const skills = [...family.skills];
  const summary =
    band === 'none'
      ? `Starting out as a ${role}, looking for a first role.`
      : `${sentenceCase(role)} with ${ZERO_YEARS_LABEL[band]} years of experience.`;

  return {
    kind: 'resume',
    resumeId,
    versionId,
    headline: titles[0] ?? role,
    ...(seed.location ? { contact: { location: seed.location } } : {}),
    summary,
    skills,
    experience,
    projects: [],
    certifications: [],
    education,
    review: {
      // A role is two checks — its title and dates, and its blank company.
      total: experience.length * 2 + skills.length + education.length,
      roles: experience.length,
      skills: [...skills],
      pendingSkills: [...skills],
      removedSkills: [],
      education: education.length,
    },
  };
}
