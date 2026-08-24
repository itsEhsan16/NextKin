import type { GenerationStatus } from './generation';

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

/** One checklist line on the score panel (Figma 1:2127–1:2178). */
export type AtsCheckItem = {
  id: string;
  label: string;
  passed: boolean;
  /** An unmet item the product can act on — it earns the "Fix" pill and counts as a quick win. */
  fixable?: boolean;
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
