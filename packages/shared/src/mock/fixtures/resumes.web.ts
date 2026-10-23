import type { Resume, ResumeVersion } from '../../models';
import type { ContentRole, DocumentContent, ResumeContent } from '../../models/resumeContent';

import { daysAgo } from './time';

/**
 * The Resumes board's library (Figma 286:1675): what the store seeds instead of `resumesFixture`
 * once a host calls `configureMockPlatform('web')` (`mock/platform.ts`). Mobile never sees it.
 *
 * Five documents, in the board's "Last updated" order, each with the tags its row draws. The
 * board's own pills disagree with those rows (ATS Optimized (2), Archived (0)); the rows won, so
 * the pills built on them read (3) and (1). The newest is also what Home's "Your Resume Progress"
 * card shows, with that board's 63% bar and 92 score (`toreview.md` §18).
 *
 * The preview (304:3321) draws one body: George as a software engineer, Google then Adobe. That
 * history is the same in every document, and each one re-tells it for its own kind of role, the
 * way V2 §7.9 has tailoring work: a document may frame what the candidate did, never invent it.
 * The Data Analyst draft has only got as far as the Google role.
 */

const GOOGLE: ContentRole = {
  id: 'role_google',
  company: 'Google',
  companyLogoUrl: 'asset:logo-google',
  title: 'Software Engineer',
  location: 'Bengaluru, India',
  period: 'Jan 2022 – Present',
  bullets: [
    'Built and maintained scalable web applications used by millions of users.',
    'Collaborated with cross-functional teams to deliver new features.',
    'Improved application performance, reducing load time by 40%.',
  ],
};

const ADOBE: ContentRole = {
  id: 'role_adobe',
  company: 'Adobe',
  companyLogoUrl: 'asset:logo-adobe',
  title: 'Software Development Engineer',
  location: 'Remote',
  period: 'Jun 2020 – Dec 2021',
  bullets: [
    'Developed internal tools to streamline workflows.',
    'Worked on cloud-based microservices using AWS.',
    'Received "Impact Award" for contributing to a key product launch.',
  ],
};

type Seed = {
  resume: Omit<Resume, 'createdAt' | 'updatedAt' | 'versionCount' | 'currentVersionId'>;
  /** Short id segment for the version ids: `ver_<slug>_<n>`. */
  slug: string;
  updatedDaysAgo: number;
  /** One change note per version, oldest first. */
  versions: string[];
  headline: string;
  summary: string;
  roles: ContentRole[];
};

/* prettier-ignore */
const SEEDS: Seed[] = [
  {
    resume: { id: 'res_swe', title: 'Software Engineer Resume', docType: 'resume', variant: 'tailored', description: 'Tailored for Product Design roles', accent: 'indigo', targetRole: 'Software Engineer', pageCount: 1, status: 'ready', linkedJobId: 'job_google', tags: ['Product Design', 'Web'] },
    slug: 'swe', updatedDaysAgo: 2,
    versions: ['Initial draft', 'Added the Adobe role', 'Tailored for product design', 'Tightened the summary'],
    headline: 'Software Engineer',
    // 304:3350, verbatim.
    summary: 'Software Engineer with 4+ years of experience building scalable web applications. Skilled in JavaScript, React, Node.js, and cloud technologies. Passionate about creating impactful products and solving real-world problems.',
    roles: [GOOGLE, ADOBE],
  },
  {
    resume: { id: 'res_pd', title: 'Product Designer Resume', docType: 'resume', variant: 'default', isBase: true, description: 'Design, UX & Product roles', accent: 'pink', targetRole: 'Product Designer', pageCount: 1, status: 'ready', tags: ['Design', 'UX'] },
    slug: 'pd', updatedDaysAgo: 8,
    versions: ['Initial draft', 'Design-first summary', 'Quantified bullets'],
    headline: 'Product Designer',
    summary: 'Engineer with 4+ years of shipping web products at Google and Adobe, moving into product design. Prototypes quickly, works side by side with designers and product managers, and cares about the details users feel.',
    roles: [GOOGLE, ADOBE],
  },
  {
    resume: { id: 'res_da', title: 'Data Analyst Resume', docType: 'resume', variant: 'template', description: 'Data & Analytics roles', accent: 'blue', targetRole: 'Data Analyst', pageCount: 1, draft: true, status: 'ready', tags: ['Data', 'Analytics'] },
    slug: 'da', updatedDaysAgo: 15,
    versions: ['Started from the Data Analyst template'],
    headline: 'Data Analyst',
    summary: 'Engineer with 4+ years of turning product data into decisions: instrumenting features, building dashboards and measuring what shipped.',
    roles: [GOOGLE],
  },
  {
    resume: { id: 'res_mm', title: 'Marketing Manager Resume', docType: 'resume', variant: 'tailored', description: 'Growth & Marketing roles', accent: 'green', targetRole: 'Marketing Manager', pageCount: 1, status: 'ready', tags: ['Growth', 'Marketing'] },
    slug: 'mm', updatedDaysAgo: 22,
    versions: ['Initial draft', 'Tailored for growth roles'],
    headline: 'Marketing Manager',
    summary: 'Engineer with 4+ years at Google and Adobe who has partnered with growth and marketing teams on launches, experiments and funnel analytics. Brings technical depth to growth and marketing roles.',
    roles: [GOOGLE, ADOBE],
  },
  {
    // 40 days: "1 month ago" needs five full weeks (`formatCoarseAge`).
    resume: { id: 'res_general', title: 'General Resume', docType: 'resume', variant: 'default', description: 'A versatile resume for all opportunities', accent: 'amber', pageCount: 1, archived: true, status: 'ready', tags: ['General'] },
    slug: 'general', updatedDaysAgo: 40,
    versions: ['Initial draft', 'Refresh'],
    headline: 'Software Engineer',
    summary: 'Software engineer with 4+ years of experience across Google and Adobe, building web applications, internal tools and cloud services.',
    roles: [GOOGLE, ADOBE],
  },
];

/** Four days between versions, the newest landing on the document's own `updatedAt`. */
const VERSION_GAP_DAYS = 4;

const versionsOf = ({ resume, slug, updatedDaysAgo, versions }: Seed): ResumeVersion[] =>
  versions.map((changeNote, index) => ({
    id: `ver_${slug}_${index + 1}`,
    resumeId: resume.id,
    version: index + 1,
    createdAt: daysAgo(updatedDaysAgo + (versions.length - 1 - index) * VERSION_GAP_DAYS),
    changeNote,
  }));

export const webResumesFixture: Resume[] = SEEDS.map((seed) => ({
  ...seed.resume,
  createdAt: daysAgo(seed.updatedDaysAgo + (seed.versions.length - 1) * VERSION_GAP_DAYS),
  updatedAt: daysAgo(seed.updatedDaysAgo),
  versionCount: seed.versions.length,
  currentVersionId: `ver_${seed.slug}_${seed.versions.length}`,
}));

export const webResumeVersionsFixture: ResumeVersion[] = SEEDS.flatMap(versionsOf);

const bodyOf = (seed: Seed): ResumeContent => ({
  kind: 'resume',
  resumeId: seed.resume.id,
  versionId: `ver_${seed.slug}_${seed.versions.length}`,
  headline: seed.headline,
  contact: {
    email: 'george.smith@gmail.com',
    phone: '+91 98765 43210',
    location: 'Bengaluru, India',
  },
  summary: seed.summary,
  // The preview draws a summary and the roles and nothing else (304:3321), so that is the body.
  skills: [],
  experience: seed.roles.map((role) => ({ ...role, bullets: [...role.bullets] })),
  projects: [],
  certifications: [],
  education: [],
  links: ['linkedin.com/in/georgesmith'],
});

export const webContentsFixture: Record<string, DocumentContent> = Object.fromEntries(
  SEEDS.map((seed) => [seed.resume.id, bodyOf(seed)]),
);
