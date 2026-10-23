import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { monthRange, unionMonths, type PartialDate } from '@nextkin/engines/dates';
import { evidenceOf } from '@nextkin/engines/document';
import { rubricById } from '@nextkin/engines/provenance';
import { buildLedger, requirementsFromJd, type Evidence, type LedgerEntry } from '@nextkin/engines/requirements';
import { matchBandFor, type MatchBasis, type MatchCriterion, type MatchBand } from '@nextkin/shared/models/job';

import type { Tx } from '../db/database';
import { loadFacts } from '../pipeline/facts';
import { profileDocument } from '../pipeline/stages/common';
import type { NormalizedJob } from './types';

/**
 * The match score (ImBackendImplementationPlan P11-03; V2 §7.13: "deterministic, non-LLM ... skill
 * overlap ... plus experience-level fit", labelled an indicative match). Method `jobmatch-1`:
 * - skills: Q-04's requirement ledger over the listing's skill lists (read without a model),
 *   against the profile's evidence, with D-14's credit (listed-only skills earn half);
 * - experience: when the listing states a years range, how the profile's dated experience meets
 *   it, weighted 20%. A listing that states no years is scored on skills alone, and says so.
 * Every number carries its basis (G16): how much of the listing there was to read, and "x of y
 * required". A listing read from a snippet or a title alone carries the band and the basis but no
 * number (toreview §105.18). Rendering a card makes zero model calls.
 */

export const MATCH_METHOD = 'jobmatch-1';
const YEARS_WEIGHT = 0.2;

export interface MatchContext {
  evidence: Evidence;
  /** Years of dated experience, overlapping roles counted once; null with no dated role. */
  years: number | null;
  asOf: PartialDate;
  /** False for an empty profile: nothing to match yet, so no match fields at all. */
  hasProfile: boolean;
}

export interface JobMatch {
  matchScore?: number;
  matchBand?: MatchBand;
  matchBasis: MatchBasis;
  matchCriteria?: MatchCriterion[];
  matchReason?: string;
  /** For ordering picks: the score even where the card withholds it. */
  sortKey: number;
}

export async function matchContext(tx: Tx, userId: string, now = new Date()): Promise<MatchContext> {
  const { facts, contact } = await loadFacts(tx, userId);
  const asOf = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  const { evidence } = evidenceOf(profileDocument(facts, contact), TAXONOMY, { minCopiedWords: 8 });
  const months = unionMonths(facts.roles.map((r) => monthRange(r, asOf)).filter((r): r is [number, number] => r !== null));
  return { evidence, years: facts.roles.length ? Math.round((months / 12) * 10) / 10 : null, asOf, hasProfile: facts.roles.length > 0 || facts.skills.length > 0 };
}

const KIND: Record<NormalizedJob['descriptionKind'], MatchBasis['kind']> = { full: 'full', snippet: 'snippet', title_only: 'title' };

function criterionOf(entry: LedgerEntry): MatchCriterion | null {
  if (entry.kind !== 'skill') return null;
  const required = entry.importance === 'required';
  const years = entry.years ? `${required ? 'Required' : 'Preferred'}: ${entry.years.asked}+ years — you show ${Math.floor(entry.years.shownMonths / 12)}` : undefined;
  if (entry.status === 'met') return { id: entry.requirementId, label: entry.text, state: 'met', ...(years ? { detail: years } : {}) };
  if (entry.status === 'partial') {
    return { id: entry.requirementId, label: entry.text, state: 'partial', detail: years ?? 'Listed on your profile, not shown in a dated role' };
  }
  return { id: entry.requirementId, label: entry.text, state: required ? 'missing' : 'optional', ...(years ? { detail: years } : {}) };
}

const list = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/** What the score reads of a listing; a job description's own page passes its reading in this shape. */
export type MatchSubject = Pick<NormalizedJob, 'requiredSkills' | 'preferredSkills' | 'descriptionKind' | 'description' | 'requirements'> & Partial<Pick<NormalizedJob, 'experienceYears'>>;

export function scoreMatch(listing: MatchSubject, ctx: MatchContext): JobMatch | null {
  if (!ctx.hasProfile) return null;
  const requirements = requirementsFromJd(
    { requiredSkills: listing.requiredSkills, preferredSkills: listing.preferredSkills, rawText: listing.descriptionKind === 'full' ? [listing.description, ...listing.requirements].join('\n') : listing.description },
    TAXONOMY,
  );
  const ledger = buildLedger({ requirements, evidence: ctx.evidence, rubric: rubricById(), asOf: ctx.asOf });
  const basis: MatchBasis = {
    kind: KIND[listing.descriptionKind],
    requiredMet: ledger.counts.requiredMet,
    requiredPartial: ledger.counts.requiredPartial,
    requiredTotal: ledger.counts.requiredTotal,
    preferredMet: ledger.counts.preferredMet,
    preferredTotal: ledger.counts.preferredTotal,
    method: MATCH_METHOD,
  };
  // No readable skill: no number, and the basis says why.
  if (ledger.matchBps === null) return { matchBasis: basis, sortKey: -1 };

  let score = ledger.matchBps / 10_000;
  const range = listing.experienceYears;
  if (range && ctx.years !== null && range.min > 0) {
    const fit = Math.min(1, ctx.years / range.min);
    score = score * (1 - YEARS_WEIGHT) + fit * YEARS_WEIGHT;
  }
  score = Math.round(score * 100) / 100;

  const criteria = ledger.entries.map(criterionOf).filter((c): c is MatchCriterion => c !== null);
  const met = criteria.filter((c) => c.state === 'met').map((c) => c.label);
  const missing = criteria.filter((c) => c.state === 'missing').map((c) => c.label);
  const reason = met.length ? `Matches ${list(met.slice(0, 3))}${missing.length ? `; missing ${missing[0]}` : ''}` : missing.length ? `Missing ${list(missing.slice(0, 2))}` : undefined;

  return {
    // A snippet or a title alone is too little to put a number on (toreview §105.18).
    ...(basis.kind === 'full' ? { matchScore: score } : {}),
    matchBand: matchBandFor(score),
    matchBasis: basis,
    matchCriteria: criteria,
    ...(reason ? { matchReason: reason } : {}),
    sortKey: score,
  };
}
