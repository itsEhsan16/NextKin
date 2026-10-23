import type {
  ContentEducation,
  ContentProject,
  ContentRole,
  CoverLetterTone,
} from '@/data/models/resumeContent';

/**
 * NextKin V2 spec §7.9 and §7.10 — the copy the mock's documents are written from.
 *
 * Split out of `documentBuilder` so that file is only assembly: this one holds the prose and
 * nothing else, which is what changes when the fixtures are reworded. The facts are George
 * Smith's, read off `fixtures/profile.ts` — §7.9 is explicit that the product never invents an
 * employer, so every name here traces back to that fixture. No artboard draws any of it, so the
 * citations are spec sections.
 */

/** §7.9: Zero Resume Mode brackets what it assumed rather than naming an employer. */
export const COMPANY_PLACEHOLDER = '[Company Name]';

/** §7.9's placeholder policy names institutions in the same breath as employers. */
export const INSTITUTION_PLACEHOLDER = '[Institution Name]';

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
export const BASE_PROJECTS: readonly ContentProject[] = [
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
export const SUMMARY_BASE =
  'Senior UX designer with eight years across Flipkart, Swiggy and PhonePe. Builds design ' +
  'systems and payment flows used by millions of shoppers in India, and measures what they ' +
  'change.';

/**
 * The same summary with no employer in it: §7.9 knows a name, a count of years and a JD, so it
 * cannot say where the years were spent. The target company stays — the JD is an input.
 */
export const SUMMARY_ASSUMED =
  'Senior UX designer with eight years in consumer product teams. Builds design systems and ' +
  'payment flows, and measures what they change.';

/** §7.10: the tone changes how the letter opens, never what it claims. */
export const GREETING: Record<CoverLetterTone, (company: string) => string> = {
  professional: () => 'Dear Hiring Manager,',
  confident: () => 'Dear Hiring Team,',
  conversational: (company) => `Hi ${company} team,`,
  concise: () => 'Hello,',
};

export const OPENING: Record<CoverLetterTone, (role: string, company: string) => string> = {
  professional: (role, company) => `I am writing to apply for the ${role} role at ${company}.`,
  confident: (role, company) =>
    `${company} is hiring a ${role}, and it is the work I already do every week.`,
  conversational: (role, company) =>
    `I saw the ${role} opening at ${company} and it reads like my last three years.`,
  concise: (role, company) => `Applying for ${role} at ${company}.`,
};

/** The same second sentence under every tone, so the four drafts stay comparable. */
export const OPENING_TAIL =
  'Eight years of product design, the last three senior, all of it consumer.';

/** Paragraph two is the evidence, and it is identical in all four tones. */
export const FACTS_PARAGRAPH =
  'Eight years of product design in India: Senior UX Designer at Flipkart since 2022, before ' +
  'that Swiggy and PhonePe. At Flipkart I rebuilt the address and payment step for 40M+ monthly ' +
  'shoppers and drop-off fell 18%; at Swiggy my discovery redesign lifted order conversion 12%.';
