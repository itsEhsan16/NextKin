import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { isQuantified } from '@nextkin/engines/quantified';
import type { CanonicalClaim, CanonicalRoleJson } from '@nextkin/shared/schemas/resumeContent';

import type { TailorRunInput } from './tailorMerge';

/** A base line kept as it was: it cites its own line of the base version, the run's facts. */
export const kept = (claim: CanonicalClaim, id: string, fact: string): CanonicalClaim => ({
  ...claim,
  id,
  evidence: claim.origin === 'generated' ? [fact] : claim.evidence,
});

/**
 * A figure the user wrote stays (toreview §129): when a rewrite of the role lost it — no line
 * citing it still states a measured result — the user's own line takes the place of the first line
 * that cited it, or joins the role when none did. The base already carries the figure.
 */
export function keepFigures(role: CanonicalRoleJson, next: CanonicalRoleJson, figures: NonNullable<TailorRunInput['figures']>, ri: number): CanonicalRoleJson {
  let bullets = next.bullets;
  for (const figure of figures.filter((f) => f.where === role.roleId)) {
    const fact = `${role.roleId}#r${figure.line}`;
    const line = role.bullets[figure.line];
    if (!line) continue;
    const citing = bullets.filter((b) => b.evidence.includes(fact));
    if (citing.some((b) => isQuantified(b.text, TAXONOMY))) continue;
    const own = kept(line, `kept-${ri}-${figure.line}`, fact);
    const at = bullets.findIndex((b) => b.evidence.includes(fact));
    bullets = at < 0 ? [...bullets, own] : bullets.flatMap((b, i) => (i === at ? [own] : b.evidence.includes(fact) ? [] : [b]));
  }
  return bullets === next.bullets ? next : { ...next, bullets };
}
