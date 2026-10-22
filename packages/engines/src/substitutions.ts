/**
 * Era-appropriate substitutions (V2 §7.7; ImBackendImplementationPlan P8-05, old M2-09). When a
 * claim is rejected or flagged, suggest what the candidate could truthfully say instead:
 * 1. their own validated skills from that period, in the same problem space;
 * 2. then KB relations whose era window fits the role.
 *
 * A substitution is a suggestion. Nothing writes one into a document without an explicit
 * confirmation: `applySubstitution` refuses unless it is handed `{ confirmed: true }`.
 */

import { compareCodePoints } from './bps';
import { kbEntry, type KnowledgeBase } from './kb';
import { skillById, type Taxonomy } from './normalizer';

export interface Substitution {
  skillId: string;
  name: string;
  source: 'own' | 'related';
  /** Always true: the user must confirm the substitute is true of them. */
  requiresConfirmation: true;
}

const MAX_SUBSTITUTIONS = 5;

function related(kb: KnowledgeBase, a: string, b: string): boolean {
  return (kbEntry(kb, a)?.related ?? []).includes(b) || (kbEntry(kb, b)?.related ?? []).includes(a);
}

export function suggestSubstitutions(input: {
  skillId: string;
  roleEndYear: number;
  /** Skills the candidate validly holds in this role's period (from every overlapping role). */
  ownValid: readonly string[];
  kb: KnowledgeBase;
  taxonomy: Taxonomy;
}): Substitution[] {
  const { skillId, roleEndYear, ownValid, kb, taxonomy } = input;
  const category = skillById(taxonomy, skillId)?.category;
  const out: Substitution[] = [];
  const seen = new Set([skillId]);
  const push = (id: string, source: Substitution['source']) => {
    const skill = skillById(taxonomy, id);
    if (!skill || seen.has(id)) return;
    seen.add(id);
    out.push({ skillId: id, name: skill.name, source, requiresConfirmation: true });
  };

  const own = [...new Set(ownValid)]
    .filter((id) => related(kb, skillId, id) || (category !== undefined && skillById(taxonomy, id)?.category === category))
    .sort(compareCodePoints);
  for (const id of own) push(id, 'own');

  for (const id of kbEntry(kb, skillId)?.related ?? []) {
    const entry = kbEntry(kb, id);
    if (entry && entry.safeUsageYear <= roleEndYear) push(id, 'related');
  }
  return out.slice(0, MAX_SUBSTITUTIONS);
}

/** What a confirmation must say. A missing or truthy-but-not-`true` value is refused. */
export interface SubstitutionConfirmation {
  confirmed: true;
}

/**
 * Replaces a rejected skill with a confirmed substitute in a role's skill list. Throws unless the
 * user's confirmation is present: no path inserts a substitution on its own (P8-05).
 */
export function applySubstitution(
  skills: readonly string[],
  rejected: string,
  substitute: Substitution,
  confirmation: SubstitutionConfirmation | undefined,
): string[] {
  if (confirmation?.confirmed !== true) {
    throw new Error('A substitution needs the user to confirm it is true.');
  }
  const out = skills.filter((skill) => skill !== rejected);
  if (!out.includes(substitute.name)) out.push(substitute.name);
  return out;
}
