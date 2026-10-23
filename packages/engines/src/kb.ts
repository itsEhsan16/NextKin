/**
 * The Technology Knowledge Base as the engines read it (V2 §7.7; ImBackendImplementationPlan
 * P8-03). One entry per technology, keyed by its canonical taxonomy id. The KB is versioned data:
 * a stored report records the version it was checked against and is never rewritten by a later
 * edit (G12).
 *
 * Only an admin-approved entry's dates are authoritative for a hard fail. A machine-generated entry
 * validates in flag-only mode: what would be Invalid is reported as Suspect instead (§7.7).
 */

import type { SkillCategory } from './normalizer';

export type KbReviewState = 'machine_generated' | 'admin_approved';
export type KbStatus = 'active' | 'deprecated' | 'superseded';

export interface KbEntry {
  /** The canonical taxonomy id. */
  skillId: string;
  releaseYear: number;
  enterpriseAdoptionYear: number;
  /** Earliest year a typical professional claim is credible: release ≤ safe ≤ adoption. */
  safeUsageYear: number;
  status: KbStatus;
  reviewState: KbReviewState;
  /** Technologies in the same problem space, in preference order, for substitutions. */
  related?: readonly string[];
}

export interface KnowledgeBase {
  id: 'kb';
  version: string;
  entries: readonly KbEntry[];
}

/** Categories whose skills are technology claims the timeline checks (§7.7). */
export const TECHNOLOGY_CATEGORIES: ReadonlySet<SkillCategory> = new Set([
  'language',
  'framework',
  'library',
  'database',
  'cloud',
  'devops',
  'tool',
]);

const kbIndexes = new WeakMap<KnowledgeBase, Map<string, KbEntry>>();

export function kbEntry(kb: KnowledgeBase, skillId: string): KbEntry | undefined {
  let index = kbIndexes.get(kb);
  if (!index) {
    index = new Map(kb.entries.map((entry) => [entry.skillId, entry]));
    kbIndexes.set(kb, index);
  }
  return index.get(skillId);
}

/** Whether an entry's dates may decide a hard fail. */
export function isAuthoritative(entry: KbEntry): boolean {
  return entry.reviewState === 'admin_approved';
}

/** Data errors in a KB: impossible windows, duplicate ids, related ids pointing nowhere. */
export function kbProblems(kb: KnowledgeBase): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const entry of kb.entries) {
    if (seen.has(entry.skillId)) problems.push(`${entry.skillId}: duplicate entry`);
    seen.add(entry.skillId);
    if (entry.safeUsageYear < entry.releaseYear) problems.push(`${entry.skillId}: safe usage before release`);
    if (entry.safeUsageYear > entry.enterpriseAdoptionYear) {
      problems.push(`${entry.skillId}: safe usage after enterprise adoption`);
    }
  }
  for (const entry of kb.entries) {
    for (const related of entry.related ?? []) {
      if (!seen.has(related)) problems.push(`${entry.skillId}: related ${related} is not in the KB`);
    }
  }
  return problems;
}
