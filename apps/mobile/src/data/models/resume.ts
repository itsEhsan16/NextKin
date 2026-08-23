import type { GenerationStatus } from './generation';

/** NextKin V2 spec §10 — Resume aggregate (candidate app). */

export type Resume = {
  id: string;
  title: string;
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
  status: GenerationStatus;
  linkedJobId?: string;
  tags: string[];
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

export type AtsBreakdownItem = {
  key: string;
  label: string;
  score: number;
  max: number;
  hint?: string;
};

export type SuggestionImpact = 'high' | 'medium' | 'low';

export type AtsSuggestion = {
  id: string;
  text: string;
  impact: SuggestionImpact;
};

export type AtsScore = {
  /** 0–100 */
  total: number;
  band: AtsBand;
  breakdown: AtsBreakdownItem[];
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: AtsSuggestion[];
};

/** Band thresholds shared by fixtures and UI meters. */
export function atsBandFor(total: number): AtsBand {
  if (total >= 85) return 'strong';
  if (total >= 70) return 'good';
  if (total >= 55) return 'fair';
  return 'weak';
}
