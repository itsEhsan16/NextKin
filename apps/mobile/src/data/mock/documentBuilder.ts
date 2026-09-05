import type {
  ContentEducation,
  ContentProject,
  ContentRole,
  CoverLetterContent,
  CoverLetterTone,
  ResumeContent,
} from '@/data/models/resumeContent';

/**
 * NextKin V2 spec §7.9 and §7.11 — the mock's document generator.
 *
 * §7.11 keeps a document as a structured model, not a rendered file, so every export format stays
 * in sync. This builder writes that model for the seeded documents (`fixtures/contents.ts`), for
 * a generation's output (plan Phase 9B) and for the "start from scratch" document the section
 * editor opens (Phase 9C) — all three the same shape. The facts are George Smith's, read off
 * `fixtures/profile.ts`: §7.9 is explicit that the product never invents an employer. No artboard
 * draws any of this, so the citations are spec sections and plan phases.
 */

/** §7.9: Zero Resume Mode brackets what it assumed rather than naming an employer. */
const COMPANY_PLACEHOLDER = '[Company Name]';

/** §7.9's placeholder policy names institutions in the same breath as employers. */
const INSTITUTION_PLACEHOLDER = '[Institution Name]';

/**
 * `profileFixture.experiences` written out as resume copy: three bullets a role, each opening on
 * an action verb and most carrying a number — the §7.8 `content_gap` check counts digits.
 */
export const BASE_ROLES: readonly ContentRole[] = [
  {
    id: 'role_flipkart',
    company: 'Flipkart',
    title: 'Senior UX Designer',
    period: 'Mar 2022 — Present',
    bullets: [
      'Rebuilt the address and payment step for 40M+ monthly shoppers, cutting drop-off 18%',
      'Led the design system across 6 squads, lifting component reuse from 34% to 81%',
      'Ran fortnightly contrast and touch-target audits that closed 120 open defects',
    ],
  },
  {
    id: 'role_swiggy',
    company: 'Swiggy',
    title: 'Product Designer',
    period: 'Jun 2019 — Feb 2022',
    bullets: [
      'Redesigned restaurant discovery, lifting order conversion 12% over a six-week test',
      'Ran 40+ moderated research sessions with users in Bengaluru, Pune and Hyderabad',
      'Built the first shared component kit for the consumer app, adopted by three squads',
    ],
  },
  {
    id: 'role_phonepe',
    company: 'PhonePe',
    title: 'UX Designer',
    period: 'Aug 2017 — May 2019',
    bullets: [
      'Simplified the UPI payment flow, reducing failed transactions 9% quarter on quarter',
      'Designed the first-time KYC journey, taking completion from 61% to 78%',
      'Wrote the usability testing playbook the payments team still runs',
    ],
  },
  {
    id: 'role_obvious',
    company: 'Obvious',
    title: 'UI Designer',
    period: 'Jan 2016 — Jul 2017',
    bullets: [
      'Shipped 14 client launches across fintech, health and education',
      'Created the visual language for a health app used by 200k patients',
      'Paired with engineers on responsive web layouts, handing off HTML and CSS',
    ],
  },
];

/** Side work. `profileFixture` has no projects, so this is the only copy the section ever holds. */
const BASE_PROJECTS: readonly ContentProject[] = [
  {
    id: 'proj_kirana',
    name: 'Kirana POS kit',
    description: 'Open-source billing UI kit for small Indian retailers.',
    bullets: [
      'Shipped 42 components with Hindi, Tamil and Kannada type support',
      'Adopted by 5 teams across two Bengaluru startups',
    ],
  },
  {
    id: 'proj_contrast',
    name: 'Contrast checker',
    description: 'A small web tool that checks token pairs against WCAG ratios.',
    bullets: [
      'Checks 1,200 token pairs in a single pass',
      'Used by the Flipkart system team on every palette change',
    ],
  },
];

/** `profileFixture.education` as printed copy: degree and field on one line, period rendered. */
export const BASE_EDUCATION: readonly ContentEducation[] = [
  {
    id: 'edu_nid',
    institution: 'National Institute of Design',
    degree: 'M.Des. Interaction Design',
    period: '2014 — 2016',
  },
  {
    id: 'edu_anna',
    institution: 'Anna University',
    degree: 'B.E. Computer Science',
    period: '2010 — 2014',
  },
];

/** The same twelve as `profileFixture.skills` ("Skills — 12", Figma 1:2251), in the same order. */
export const BASE_SKILLS: readonly string[] = [
  'Figma',
  'Design systems',
  'Prototyping',
  'User research',
  'Accessibility',
  'Interaction design',
  'Usability testing',
  'Information architecture',
  'Design tokens',
  'Motion design',
  'Workshop facilitation',
  'HTML & CSS',
];

/** Under 60 words and free of first-person pronouns — the two §7.8 summary checks. */
const SUMMARY_BASE =
  'Senior UX designer with eight years across Flipkart, Swiggy and PhonePe. Builds design ' +
  'systems and payment flows used by millions of shoppers in India, and measures what they ' +
  'change.';

/**
 * The same summary with no employer in it: §7.9 knows a name, a count of years and a JD, so it
 * cannot say where the years were spent. The target company stays — the JD is an input.
 */
const SUMMARY_ASSUMED =
  'Senior UX designer with eight years in consumer product teams. Builds design systems and ' +
  'payment flows, and measures what they change.';

function defaultSummary(targetRole?: string, targetCompany?: string, assumed?: boolean): string {
  const base = assumed ? SUMMARY_ASSUMED : SUMMARY_BASE;
  if (!targetRole) return base;
  const target = targetCompany ? `${targetRole} at ${targetCompany}` : targetRole;
  return `${base} Now targeting ${target}.`;
}

/** Every employer this builder can name, so no line can name one the same draft has bracketed. */
const EMPLOYERS: readonly string[] = BASE_ROLES.map((role) => role.company);

const maskEmployers = (text: string): string =>
  EMPLOYERS.reduce((masked, name) => masked.split(name).join(COMPANY_PLACEHOLDER), text);

/**
 * §7.9's placeholder-and-flag policy over the whole document: employers and institutions become
 * bracketed placeholders wherever they appear — summary and bullets included, or the draft would
 * name the employers it just bracketed — and every role, project and education entry carries its
 * "needs review" flag, so `contentNeedsReview` holds the download gate shut.
 */
const asAssumed = (content: ResumeContent): ResumeContent => ({
  ...content,
  summary: maskEmployers(content.summary),
  experience: content.experience.map((role) => ({
    ...role,
    company: COMPANY_PLACEHOLDER,
    bullets: role.bullets.map(maskEmployers),
    needsReview: true,
  })),
  projects: content.projects.map((project) => ({
    ...project,
    bullets: project.bullets.map(maskEmployers),
    needsReview: true,
  })),
  education: content.education.map((entry) => ({
    ...entry,
    institution: INSTITUTION_PLACEHOLDER,
    needsReview: true,
  })),
});

// Every document shares these constants, so each build takes its own copy: a builder that handed
// out the constant itself would let an edit to one document change the next one built.
const cloneRoles = (): ContentRole[] =>
  BASE_ROLES.map((role) => ({ ...role, bullets: [...role.bullets] }));

const cloneProjects = (): ContentProject[] =>
  BASE_PROJECTS.map((project) => ({ ...project, bullets: [...project.bullets] }));

const cloneEducation = (): ContentEducation[] => BASE_EDUCATION.map((entry) => ({ ...entry }));

/**
 * George's resume, targeted by the caller. `blank` returns an empty document — "start from
 * scratch", all six editor sections waiting. `needsReview` is Zero Resume Mode (§7.9): every role,
 * project and education entry flagged, and no employer or institution named anywhere in the
 * document, so the download gate holds until the user confirms.
 */
export function buildResumeContent(opts: {
  resumeId: string;
  versionId: string;
  summary?: string;
  skills?: string[];
  /** Read only when `summary` is omitted; generation (Phase 9B) passes the JD role and company. */
  targetRole?: string;
  targetCompany?: string;
  needsReview?: boolean;
  blank?: boolean;
}): ResumeContent {
  const { resumeId, versionId, summary, skills, targetRole, targetCompany, needsReview } = opts;

  const content: ResumeContent = {
    kind: 'resume',
    resumeId,
    versionId,
    summary: summary ?? defaultSummary(targetRole, targetCompany, needsReview),
    skills: skills ? [...skills] : [...BASE_SKILLS],
    experience: cloneRoles(),
    projects: cloneProjects(),
    // Empty on purpose: "Certifications — Add" (Figma 1:2256) is an empty state on the profile too.
    certifications: [],
    education: cloneEducation(),
    // No `links`: the §7.8 "Add a portfolio link" fix writes here, and every fixture whose panel
    // raises that fix needs somewhere for the fix to land.
  };

  if (opts.blank)
    return { ...content, summary: '', skills: [], experience: [], projects: [], education: [] };
  return needsReview ? asAssumed(content) : content;
}

/** §7.10: the tone changes how the letter opens, never what it claims. */
const GREETING: Record<CoverLetterTone, (company: string) => string> = {
  professional: () => 'Dear Hiring Manager,',
  confident: () => 'Dear Hiring Team,',
  conversational: (company) => `Hi ${company} team,`,
  concise: () => 'Hello,',
};

const OPENING: Record<CoverLetterTone, (role: string, company: string) => string> = {
  professional: (role, company) => `I am writing to apply for the ${role} role at ${company}.`,
  confident: (role, company) =>
    `${company} is hiring a ${role}, and it is the work I already do every week.`,
  conversational: (role, company) =>
    `I saw the ${role} opening at ${company} and it reads like my last three years.`,
  concise: (role, company) => `Applying for ${role} at ${company}.`,
};

/** The same second sentence under every tone, so the four drafts stay comparable. */
const OPENING_TAIL = 'Eight years of product design, the last three senior, all of it consumer.';

/** Paragraph two is the evidence, and it is identical in all four tones. */
const FACTS_PARAGRAPH =
  'Eight years of product design in India: Senior UX Designer at Flipkart since 2022, before ' +
  'that Swiggy and PhonePe. At Flipkart I rebuilt the address and payment step for 40M+ monthly ' +
  'shoppers and drop-off fell 18%; at Swiggy my discovery redesign lifted order conversion 12%.';

/**
 * A three-paragraph letter written from a resume version. `resumeId`/`versionId` are that source
 * version — §7.10's link back to the resume — not the letter's own ids; the letter is its own
 * document, keyed by its own id in `fixtures/contents.ts`.
 */
export function buildCoverLetterContent(opts: {
  resumeId: string;
  versionId: string;
  tone: CoverLetterTone;
  company: string;
  role: string;
  skills?: string[];
}): CoverLetterContent {
  const { resumeId, versionId, tone, company, role, skills } = opts;
  const focus = (skills ?? BASE_SKILLS).slice(0, 3).join(', ');
  return {
    kind: 'cover_letter',
    resumeId,
    versionId,
    tone,
    greeting: GREETING[tone](company),
    paragraphs: [
      `${OPENING[tone](role, company)} ${OPENING_TAIL}`,
      FACTS_PARAGRAPH,
      `Strongest on ${focus}. The portfolio is at georgesmith.design, with a longer write-up of ` +
        `the Flipkart system work. Happy to walk ${company} through any of it.`,
    ],
    signoff: 'Regards,\nGeorge Smith',
  };
}
