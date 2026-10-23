/**
 * Typed fixes (V2 §7.8; ImBackendImplementationPlan P8-07, C-10). Honest by construction:
 * - `surface_backed_skill`: the profile backs a skill the document does not show. The fix cites the
 *   profile roles it comes from.
 * - `gap`: the JD asks for something the profile does not back. Never insertable; worth no points.
 * - `ask_for_number`: a bullet with no measurable outcome. The user supplies the real figure; nothing
 *   invents one.
 * - `complete_section`, `formatting`, `resolve_timeline`, `mirror_wording`: the rest of the report,
 *   each pointing at what to change.
 *
 * Every impact is simulated by re-scoring the edited input under the same rubric, never estimated.
 */

import { compareCodePoints, type Bps } from './bps';
import { evidenceOf, type ScoringDocument } from './document';
import type { Importance } from './requirements';
import { evidenceTier } from './requirements';
import { scoreCore, type FormatCheckId, type ScoreInput, type ScoreResult, type SectionCheckId } from './rubric';
import { isQuantified } from './quantified';
import type { Substitution } from './substitutions';

export type Fix =
  | {
      id: string;
      type: 'surface_backed_skill';
      requirementId: string;
      skillId: string;
      /** The JD's wording, which the document should use. */
      skillName: string;
      importance: Importance;
      target: { roleId: string } | { section: 'skills' };
      /** Profile roles that demonstrate it (empty when the profile only lists it). */
      evidenceRoleIds: string[];
      impactBps: Bps;
    }
  | { id: string; type: 'gap'; requirementId: string; skillName: string; importance: Importance; insertable: false; impactBps: 0 }
  | { id: string; type: 'ask_for_number'; roleId: string; bulletIndex: number; impactBps: Bps }
  | { id: string; type: 'complete_section'; check: SectionCheckId; impactBps: Bps }
  | { id: string; type: 'formatting'; check: FormatCheckId; impactBps: Bps }
  | { id: string; type: 'mirror_wording'; requirementId: string; from: string; to: string; impactBps: 0 }
  | {
      id: string;
      type: 'resolve_timeline';
      roleId: string;
      skillId: string;
      skillName: string;
      verdict: 'invalid' | 'suspect';
      substitutions: Substitution[];
      impactBps: Bps;
    };

export type FixType = Fix['type'];

const TYPE_RANK: Record<FixType, number> = {
  resolve_timeline: 0,
  surface_backed_skill: 1,
  ask_for_number: 2,
  complete_section: 3,
  formatting: 4,
  gap: 5,
  mirror_wording: 6,
};

const TIER_RANK = { unbacked: 0, listed: 1, demonstrated: 2 } as const;

function withSkill(doc: ScoringDocument, skill: string, roleId: string | null): ScoringDocument {
  if (roleId === null) return { ...doc, skills: [...doc.skills, skill] };
  return { ...doc, roles: doc.roles.map((r) => (r.id === roleId ? { ...r, skills: [...(r.skills ?? []), skill] } : r)) };
}

function withQuantifiedBullet(doc: ScoringDocument, roleId: string, index: number): ScoringDocument {
  return {
    ...doc,
    roles: doc.roles.map((r) => (r.id === roleId ? { ...r, bullets: r.bullets.map((b, i) => (i === index ? `${b} (1)` : b)) } : r)),
  };
}

export function buildFixes(input: ScoreInput, base: Omit<ScoreResult, 'fixes'>): Fix[] {
  const fixes: Fix[] = [];
  const impact = (next: ScoreInput, assume?: Parameters<typeof scoreCore>[1]) => scoreCore(next, assume).pointsBps - base.pointsBps;
  const profile = input.profile ? evidenceOf(input.profile, input.taxonomy, { minCopiedWords: Number.MAX_SAFE_INTEGER }).evidence : null;

  for (const entry of base.ledger) {
    if (entry.kind !== 'skill' || !entry.skillId || !entry.tier) continue;
    if (entry.wording) {
      fixes.push({ id: `wording:${entry.requirementId}`, type: 'mirror_wording', requirementId: entry.requirementId, from: entry.wording.resume, to: entry.wording.jd, impactBps: 0 });
    }
    if (entry.tier === 'demonstrated') continue;
    const backed = profile ? evidenceTier(profile, entry.skillId) : null;
    if (backed && TIER_RANK[backed.tier] > TIER_RANK[entry.tier]) {
      const roleId = backed.roleIds.find((id) => input.document.roles.some((r) => r.id === id)) ?? null;
      const next = { ...input, document: withSkill(input.document, entry.text, roleId) };
      fixes.push({
        id: `skill:${entry.requirementId}`,
        type: 'surface_backed_skill',
        requirementId: entry.requirementId,
        skillId: entry.skillId,
        skillName: entry.text,
        importance: entry.importance,
        target: roleId === null ? { section: 'skills' } : { roleId },
        evidenceRoleIds: backed.roleIds,
        impactBps: impact(next),
      });
    } else if (entry.status === 'gap') {
      fixes.push({ id: `gap:${entry.requirementId}`, type: 'gap', requirementId: entry.requirementId, skillName: entry.text, importance: entry.importance, insertable: false, impactBps: 0 });
    }
  }

  for (const role of input.document.roles) {
    const index = role.bullets.findIndex((b) => !isQuantified(b, input.taxonomy));
    if (index < 0) continue;
    const next = { ...input, document: withQuantifiedBullet(input.document, role.id, index) };
    fixes.push({ id: `number:${role.id}:${index}`, type: 'ask_for_number', roleId: role.id, bulletIndex: index, impactBps: impact(next) });
  }

  const sections = base.components.find((c) => c.key === 'sections')?.checks ?? [];
  for (const check of sections.filter((c) => !c.passed)) {
    const id = check.id as SectionCheckId;
    fixes.push({ id: `section:${id}`, type: 'complete_section', check: id, impactBps: impact(input, { passedSections: new Set([id]) }) });
  }
  const formatting = base.components.find((c) => c.key === 'formatting')?.checks ?? [];
  for (const check of formatting.filter((c) => !c.passed)) {
    const id = check.id as FormatCheckId;
    fixes.push({ id: `format:${id}`, type: 'formatting', check: id, impactBps: impact(input, { passedFormat: new Set([id]) }) });
  }

  for (const pair of base.timeline.pairs) {
    if (pair.included || (pair.verdict !== 'invalid' && pair.verdict !== 'suspect')) continue;
    fixes.push({
      id: `timeline:${pair.roleId}:${pair.skillId}`,
      type: 'resolve_timeline',
      roleId: pair.roleId,
      skillId: pair.skillId,
      skillName: pair.name,
      verdict: pair.verdict,
      substitutions: pair.substitutions,
      impactBps: impact(input, { removedClaims: new Set([`${pair.roleId}\u0000${pair.skillId}`]) }),
    });
  }

  return fixes.sort((a, b) => b.impactBps - a.impactBps || TYPE_RANK[a.type] - TYPE_RANK[b.type] || compareCodePoints(a.id, b.id));
}
