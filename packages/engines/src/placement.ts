/**
 * Where a skill the user has is best said (toreview §129, owner 2026-10-22: "when the user ticks
 * I have this, the AI decides where to put it"). By code, so the plan measures the step at the very
 * role the screen names and the run writes it there: the projection stays a re-score.
 *
 * - Only a dated role whose dates fit the technology may take it (the timeline engine decides:
 *   a role that ends before the release, or inside the early-adoption window, never does).
 * - The role whose work is closest wins: what it already uses that the KB relates to the skill,
 *   then skills of the same kind, then the words of the skill in its text.
 * - Ties go to the current role, then the later start: the most recent evidence reads strongest.
 * - Null when no dated role fits: the skill goes to the skills list, at the listed credit (D-14).
 */

import { monthIndex, type PartialDate } from './dates';
import type { ScoringDocument, ScoringRole } from './document';
import { kbEntry, type KnowledgeBase } from './kb';
import { mentionsIn, resolveSkill, skillById, type Taxonomy } from './normalizer';
import { phraseKey } from './text';
import { validateTimeline } from './timeline';

export interface PlacementContext {
  kb: KnowledgeBase;
  taxonomy: Taxonomy;
  asOf: PartialDate;
}

const roleText = (r: ScoringRole) => [r.title, ...r.bullets].join('\n');

/** Whether the timeline engine lets this role carry the skill. */
function fits(role: ScoringRole, skill: string, ctx: PlacementContext): boolean {
  const report = validateTimeline({ roles: [{ id: role.id, start: role.start, end: role.end, skills: [skill] }], kb: ctx.kb, taxonomy: ctx.taxonomy, asOf: ctx.asOf });
  return report.pairs.every((p) => p.included);
}

/** How close the role's work is to the skill: related use first, then the same kind, then words. */
function closeness(role: ScoringRole, skill: string, ctx: PlacementContext): number {
  const ref = resolveSkill(ctx.taxonomy, skill);
  const own = new Set([...(role.skills ?? []).map((s) => resolveSkill(ctx.taxonomy, s).id), ...mentionsIn(ctx.taxonomy, roleText(role)).map((m) => m.skillId)]);
  if (own.has(ref.id)) return 100;
  const related = new Set(kbEntry(ctx.kb, ref.id)?.related ?? []);
  const relatedBack = [...own].filter((id) => kbEntry(ctx.kb, id)?.related?.includes(ref.id)).length;
  const relatedUse = [...own].filter((id) => related.has(id)).length + relatedBack;
  const category = skillById(ctx.taxonomy, ref.id)?.category;
  const sameKind = category ? [...own].filter((id) => skillById(ctx.taxonomy, id)?.category === category).length : 0;
  const words = !ref.known && ` ${phraseKey(roleText(role))} `.includes(` ${phraseKey(skill)} `) ? 1 : 0;
  return relatedUse * 4 + sameKind * 2 + words * 3;
}

const endOf = (r: ScoringRole) => (r.end === null ? Number.MAX_SAFE_INTEGER : r.end ? monthIndex(r.end) : -1);

/** The role to say the skill at, or null when no dated role's dates fit it. */
export function bestRoleFor(skill: string, document: ScoringDocument, ctx: PlacementContext): string | null {
  const candidates = document.roles
    .filter((r) => r.start && r.end !== undefined && fits(r, skill, ctx))
    .map((r) => ({ id: r.id, score: closeness(r, skill, ctx), end: endOf(r), start: monthIndex(r.start!) }))
    .sort((a, b) => b.score - a.score || b.end - a.end || b.start - a.start);
  return candidates[0]?.id ?? null;
}
