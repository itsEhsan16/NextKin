import { KB } from '@nextkin/engines/datasets/kb';
import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import type { PartialDate } from '@nextkin/engines/dates';
import type { FormatFacts, ScoringDocument } from '@nextkin/engines/document';
import { scoreCore } from '@nextkin/engines/rubric';

import { requirementsOf } from './adapters';
import type { ScoringJd } from './report';

/**
 * What a document is worth to the score, for comparing two versions of it (owner, 2026-11-25: a
 * page fit must never lower the score). The same inputs as `scoreDocument`, through the engine's
 * plain scoring only: no fixes and no path, so it is cheap enough to ask once per line a fit
 * thinks of leaving out. Pure.
 */
export interface Worth {
  /** The score in basis points; the measured parts' points when there is no job (D-15). */
  points: number;
  /** How many of the job's keywords the document shows, in full or in part. */
  matched: number;
}

export function worthOf(args: { document: ScoringDocument; format: FormatFacts; asOf: PartialDate; jd?: ScoringJd; profile?: ScoringDocument }): Worth {
  const { document, format, asOf, jd, profile } = args;
  const result = scoreCore({
    document,
    format,
    asOf,
    kb: KB,
    taxonomy: TAXONOMY,
    ...(jd ? { jd: { requirements: requirementsOf(jd), text: jd.rawText, completeness: jd.completeness, ...(jd.title ? { title: jd.title } : {}) } } : {}),
    ...(profile ? { profile } : {}),
  });
  return {
    points: result.totalBps ?? result.pointsBps,
    matched: result.ledger.filter((e) => e.status === 'met' || e.status === 'partial').length,
  };
}

/** Whether `after` is worth at least what `before` was: no fewer points, no fewer keywords shown. */
export const holdsWorth = (before: Worth, after: Worth): boolean => after.points >= before.points && after.matched >= before.matched;
