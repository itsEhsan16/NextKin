import type { ZeroReview } from './zeroResume';

/**
 * NextKin V2 spec §7.11 — document content (the structured model, not a rendered file).
 *
 * `resume.ts` carries a document's metadata; this file carries the body those metadata describe.
 * §7.11 is explicit that the editor edits "the structured resume model, not a rendered file, so
 * all export formats stay in sync" — generation (plan Phase 9B) writes this shape and the section
 * editor (Phase 9C) mutates it. No artboard exists for either, so the citations here are spec
 * sections rather than Figma node ids.
 *
 * `kind` is the discriminant: a caller can narrow a `DocumentContent` on the content alone,
 * without reaching for the parent `Resume.docType`.
 */

/** The six sections §7.11 names for the rich section editor. */
export type ResumeSectionKey =
  'summary' | 'skills' | 'experience' | 'projects' | 'certifications' | 'education';

/** The order the editor renders, and the deterministic export order of §7.12. */
export const RESUME_SECTION_ORDER: readonly ResumeSectionKey[] = [
  'summary',
  'skills',
  'experience',
  'projects',
  'certifications',
  'education',
] as const;

/**
 * Whether a string names one of §7.11's six sections. The section editor is reached by a route
 * param, so an arbitrary string arrives at the screen and has to be checked before it indexes
 * anything.
 */
export const isResumeSectionKey = (value: string): value is ResumeSectionKey =>
  (RESUME_SECTION_ORDER as readonly string[]).includes(value);

/**
 * Everything the section editor can open: §7.11's six resume sections, plus the letter body a
 * cover letter has instead of them (§7.10). The route carries this rather than ResumeSectionKey,
 * because both document kinds are edited through the same screen.
 */
export type EditableSectionKey = ResumeSectionKey | 'letter';

export const isEditableSectionKey = (value: string): value is EditableSectionKey =>
  value === 'letter' || isResumeSectionKey(value);

/** Section headers in the editor and in the printed document. */
export const RESUME_SECTION_LABEL: Record<ResumeSectionKey, string> = {
  summary: 'Professional summary',
  skills: 'Skills',
  experience: 'Experience',
  projects: 'Projects',
  certifications: 'Certifications',
  education: 'Education',
};

/** The same headers, plus the one a cover letter's body is filed under in the editor. */
export const EDITABLE_SECTION_LABEL: Record<EditableSectionKey, string> = {
  ...RESUME_SECTION_LABEL,
  letter: 'Letter',
};

export type ContentRole = {
  id: string;
  company: string;
  title: string;
  /** Rendered span, e.g. "Mar 2022 — Present" — the resume prints this, not two dates. */
  period: string;
  /** The profile role this came from (C-10): what its claims cite. */
  roleId?: string;
  /** Structured dates behind `period`: YYYY or YYYY-MM; `end: null` is "present" (C-10). */
  start?: string;
  end?: string | null;
  /** The profile's skill tags for this role: the evidence its technology claims rest on. */
  skills?: string[];
  /** Where the role was based, printed after the employer: "Google • Bengaluru, India". */
  location?: string;
  /**
   * The employer's mark, an `asset:` key or URL as on `Job.companyLogoUrl`. Display only: the web
   * preview draws it beside the role (Figma 304:3355), and no export prints it, because V2 §7.12
   * keeps images out of the document itself.
   */
  companyLogoUrl?: string;
  bullets: string[];
  /**
   * Zero Resume Mode assumed this role; the download gate holds until the user confirms it
   * (V2 §7.9).
   */
  needsReview?: boolean;
};

export type ContentProject = {
  id: string;
  name: string;
  description: string;
  bullets: string[];
  /** Same review gate as a role: an assumed project blocks download until confirmed (V2 §7.9). */
  needsReview?: boolean;
};

export type ContentEducation = {
  id: string;
  institution: string;
  degree: string;
  /** Rendered span, e.g. "2014 — 2016". */
  period: string;
  /**
   * Zero Resume Mode assumed this entry; the download gate holds until the user confirms it
   * (V2 §7.9 flags education entries alongside roles).
   */
  needsReview?: boolean;
};

/** The contact line a printed resume opens with (Figma 304:3326). */
export type ContentContact = { email?: string; phone?: string; location?: string };

/** Where one line of a resume came from (toreview §146.4). */
export type LineSource = {
  /** The line as the page prints it. */
  text: string;
  /** `generated`: the AI wrote it. `user`: the person's own. `assumed`: a guess to check. */
  origin: 'generated' | 'user' | 'assumed';
  /** What it rests on, in words: "Your Designer role at Acme". */
  facts: string[];
  /** The line it replaced, when the AI reworded one of the person's. */
  before?: string;
};

export type ResumeContent = {
  kind: 'resume';
  resumeId: string;
  versionId: string;
  /**
   * The resume's own header as its file printed it: the name and the contact row, in order
   * (toreview §111). When present it is what the page shows, not the account's name and email.
   */
  header?: { name: string; items: { text: string; url?: string }[] };
  /** The line under the name: the title this document presents the candidate as. */
  headline?: string;
  /**
   * Contact details as the document prints them. Part of the body, like everything else here, so
   * a version keeps the details it went out with (V2 §7.6 snapshots the profile at generation).
   */
  contact?: ContentContact;
  summary: string;
  skills: string[];
  experience: ContentRole[];
  projects: ContentProject[];
  certifications: string[];
  education: ContentEducation[];
  /** Portfolio and profile URLs. The "Add a portfolio link" ATS fix writes here. */
  links?: string[];
  /** A Zero Resume draft's checklist (V2 §7.9): what it guessed, and the skills still to answer. */
  review?: ZeroReview;
};

/** V2 §7.10: Professional is the default; regenerating in a new tone keeps the earlier drafts. */
export type CoverLetterTone = 'professional' | 'confident' | 'conversational' | 'concise';

export const COVER_LETTER_TONE_LABEL: Record<CoverLetterTone, string> = {
  professional: 'Professional',
  confident: 'Confident',
  conversational: 'Conversational',
  concise: 'Concise',
};

/** One line under each tone in the picker. */
export const COVER_LETTER_TONE_HINT: Record<CoverLetterTone, string> = {
  professional: 'Measured and formal — the safe default',
  confident: 'Leads with results and claims them',
  conversational: 'Warmer, closer to how you talk',
  concise: 'Three short paragraphs, nothing spare',
};

export type CoverLetterContent = {
  kind: 'cover_letter';
  /** The resume the letter was written from; §7.10 stores letters against a resume version. */
  resumeId: string;
  versionId: string;
  tone: CoverLetterTone;
  greeting: string;
  paragraphs: string[];
  signoff: string;
  /** Zero Resume Mode wrote from assumed facts; the download gate holds (V2 §7.9). */
  needsReview?: boolean;
};

/** Both document kinds, discriminated on `kind`. */
export type DocumentContent = ResumeContent | CoverLetterContent;

/** A bracketed placeholder Zero Resume left for the user: "[Company Name]", "[Degree]". */
const PLACEHOLDER = /^\s*\[.*\]\s*$/;

/**
 * Whether the V2 §7.9 review gate still holds this document back from download: the letter is
 * flagged, any role, project or education entry is, or a bracketed placeholder is still printed
 * (§7.9 blocks export "while any flag is unresolved or any placeholder remains"). Skills and
 * certifications are plain strings and cannot carry a flag, so a Zero Resume draft lists its open
 * skill claims in `review.pendingSkills` instead.
 */
export function contentNeedsReview(content: DocumentContent): boolean {
  if (content.kind === 'cover_letter') return content.needsReview === true;
  return (
    content.experience.some(
      (role) => role.needsReview === true || PLACEHOLDER.test(role.company),
    ) ||
    content.projects.some((project) => project.needsReview === true) ||
    content.education.some(
      (entry) =>
        entry.needsReview === true ||
        PLACEHOLDER.test(entry.institution) ||
        PLACEHOLDER.test(entry.degree),
    ) ||
    // A Zero Resume draft lists its skill claims, since a plain string cannot carry a flag.
    (content.review?.pendingSkills.length ?? 0) > 0
  );
}
