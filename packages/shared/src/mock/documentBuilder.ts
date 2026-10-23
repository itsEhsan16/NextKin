import type {
  ContentEducation,
  ContentProject,
  ContentRole,
  CoverLetterContent,
  CoverLetterTone,
  ResumeContent,
} from '@/data/models/resumeContent';

import {
  BASE_EDUCATION,
  BASE_PROJECTS,
  BASE_ROLES,
  BASE_SKILLS,
  COMPANY_PLACEHOLDER,
  FACTS_PARAGRAPH,
  GREETING,
  INSTITUTION_PLACEHOLDER,
  OPENING,
  OPENING_TAIL,
  SUMMARY_ASSUMED,
  SUMMARY_BASE,
} from './documentCopy';

/**
 * NextKin V2 spec §7.9 and §7.11 — the mock's document generator.
 *
 * §7.11 keeps a document as a structured model, not a rendered file, so every export format stays
 * in sync. This builder writes that model for the seeded documents (`fixtures/contents.ts`), for
 * a generation's output (plan Phase 9B) and for the "start from scratch" document the section
 * editor opens (Phase 9C) — all three the same shape. The prose it assembles lives next door in
 * `documentCopy`; this file is only the assembly.
 */

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
