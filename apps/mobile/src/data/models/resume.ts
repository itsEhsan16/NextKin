import type { GenerationStatus } from './generation';
import type { ResumeSectionKey } from './resumeContent';

/** NextKin V2 spec §10 — Resume aggregate (candidate app). */

/** The Resumes library holds both document kinds (Figma RESUMES 01 type filter). */
export type ResumeDocType = 'resume' | 'cover_letter';

export type Resume = {
  id: string;
  title: string;
  docType: ResumeDocType;
  /** The one resume the tailored copies derive from (RESUMES pill "Base", 1:1422). */
  isBase?: boolean;
  /** The linked JD changed since this doc was generated (amber pill, Figma 1:1440). */
  updateAvailable?: boolean;
  /** Print length; the list row quotes it for the base resume (Figma 1:1632). */
  pageCount?: number;
  targetCompany?: string;
  targetRole?: string;
  thumbnailUrl?: string;
  /** ISO-8601 */
  createdAt: string;
  /** ISO-8601 */
  updatedAt: string;
  versionCount: number;
  currentVersionId: string;
  /** 0–100; absent until scoring completes. */
  atsScore?: number;
  /** 0–1 — how complete the resume content is (sections filled, review gates passed). */
  completeness?: number;
  /** Outcome of the V2 §7.7 / §7.8 validation passes, shown as checks on the dashboard. */
  validation?: ResumeValidation;
  status: GenerationStatus;
  linkedJobId?: string;
  tags: string[];
  /**
   * Zero Resume Mode output the user has not confirmed yet; blocks download (V2 §7.9).
   * duplicate() copies it deliberately — a copy of an unreviewed draft is still unreviewed.
   */
  needsReview?: boolean;
};

export type ResumeValidation = {
  timelineValid: boolean;
  atsOptimized: boolean;
  jdMatched: boolean;
};

export type ResumeVersion = {
  id: string;
  resumeId: string;
  /** 1-based, monotonically increasing per resume. */
  version: number;
  /** ISO-8601 */
  createdAt: string;
  changeNote?: string;
};

export type AtsBand = 'strong' | 'good' | 'fair' | 'weak';

/** Band pill copy on the score panel (Figma 1:2119). */
export const ATS_BAND_LABEL: Record<AtsBand, string> = {
  strong: 'Strong',
  good: 'Good',
  fair: 'Fair',
  weak: 'Weak',
};

/**
 * V2 §7.8 calls this the NextKin Score and requires a rubric link from every score display. The
 * built screens say "ATS score" (Figma RESUMES 04's own label), so the built vocabulary stands and
 * this constant is the single place to change it if design decides otherwise. Never claim
 * compatibility with a named third-party ATS.
 */
export const SCORE_LABEL = 'ATS score';
/** The ring's label. */
export const SCORE_LABEL_CAPS = 'ATS SCORE';

/** One weighted component of the published rubric (V2 §7.8). */
export type ScoreRubricComponent = { key: string; label: string; weight: number; detail: string };

/**
 * The five components of V2 §7.8's rubric, in the spec's order and at the spec's initial weights
 * (they sum to 100). §7.8 requires the rubric to be published in-product and reachable from every
 * score display, so this is the copy `ScoreRubricScreen` renders — the weights are the product's
 * public claim about the number, not a UI detail.
 */
export const SCORE_RUBRIC: readonly ScoreRubricComponent[] = [
  {
    key: 'keywords',
    label: 'Keyword match',
    weight: 40,
    detail:
      'We compare the skills and tools the job description asks for against what your resume actually says, counting the required ones heavier than the preferred ones. Closing a required-skill gap moves this component more than anything else on the page. A keyword your profile does not back is shown as a gap, never written in for you.',
  },
  {
    key: 'timeline',
    label: 'Timeline validity',
    weight: 20,
    detail:
      'Every technology on the document is checked against the dates of the role it sits under. Claims that hold up raise this component; one unresolved conflict — a tool cited years before it existed — takes it to zero on its own.',
  },
  {
    key: 'sections',
    label: 'Section completeness',
    weight: 15,
    detail:
      'Summary, skills, dated experience, education and contact details each need to be there and to say something. Filling a thin section, or adding the dates a role is missing, moves this.',
  },
  {
    key: 'formatting',
    label: 'Formatting and parseability',
    weight: 15,
    detail:
      'This looks at the shape of the document rather than the words: one column, standard headings, real text instead of tables or images, contact details in the body, and dates written the same way throughout. Switching to a parse-safe template usually settles it in one step.',
  },
  {
    key: 'achievements',
    label: 'Quantified achievements',
    weight: 10,
    detail:
      'We look for measurable outcomes in your experience bullets — numbers, percentages, scale, time saved. Turning "improved onboarding" into "cut onboarding from five days to two" moves this component.',
  },
];

/**
 * V2 §7.8's honesty note, in the product's voice. It is binding on every surface that shows a
 * score, and it is the spine of the rubric screen rather than a footnote on it: the number is a
 * measurement against our own rubric and nothing more. Never soften it into a promise.
 */
export const SCORE_HONESTY_NOTE = `There is no universal ${SCORE_LABEL}. This one measures your document against NextKin's own published rubric — the five components below, and nothing else. It is not a prediction of how any particular employer's software will read, rank or filter your application: every system parses differently, and no tool can honestly promise a result in one. Use the number to make the document stronger, not to guess at an outcome.`;

/**
 * Where a fixable check lands. Every editor section qualifies, plus `'links'` — that one is not an
 * editor section but `ResumeContent.links`, which is where the "Add a portfolio link" fix writes.
 */
export type AtsFixTarget = ResumeSectionKey | 'links';

/** One checklist line on the score panel (Figma 1:2127–1:2178). */
export type AtsCheckItem = {
  id: string;
  label: string;
  passed: boolean;
  /** An unmet item the product can act on — it earns the "Fix" pill and counts as a quick win. */
  fixable?: boolean;
  /** What to do about it, shown on the fix screen: 'Add "A/B testing" to your skills'. */
  suggestion?: string;
  /** Which editor section the fix lands in — or `'links'` for the portfolio-link fix. */
  section?: AtsFixTarget;
  /**
   * false = a JD keyword the profile does not back. Shown as a gap and never inserted — V2 §7.8
   * forbids presenting missing keywords as text to paste in.
   */
  supported?: boolean;
};

/** "Content", "Format", "Keywords", "Best practices" (Figma RESUMES 04). */
export type AtsSection = {
  key: string;
  label: string;
  items: AtsCheckItem[];
};

export type AtsScore = {
  /** 0–100 */
  total: number;
  band: AtsBand;
  /** One-line verdict under the band pill ("Parsers will read this cleanly. …"). */
  summary: string;
  sections: AtsSection[];
};

/** Band thresholds shared by fixtures and UI meters. */
export function atsBandFor(total: number): AtsBand {
  if (total >= 85) return 'strong';
  if (total >= 70) return 'good';
  if (total >= 55) return 'fair';
  return 'weak';
}

/** Unmet, actionable items — the count behind "Fix 4 quick wins" (Figma 1:2187). */
export function atsQuickWins(score: AtsScore): AtsCheckItem[] {
  return score.sections.flatMap((section) => section.items.filter((i) => !i.passed && i.fixable));
}

/** "4 of 5" — how a section header summarises its checklist (Figma 1:2124). */
export function atsSectionPassed(section: AtsSection): number {
  return section.items.filter((item) => item.passed).length;
}
