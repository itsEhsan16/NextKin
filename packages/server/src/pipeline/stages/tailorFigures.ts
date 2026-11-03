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

const MINOR = new Set(['the', 'a', 'an', 'by', 'about', 'around', 'roughly', 'it', 'of', 'to', 'for', 'in', 'on', 'with', 'and', 'from', 'its', 'their']);
const words = (text: string) => (text.toLowerCase().replace(/[‐-―]/g, '-').match(/[a-z0-9%$€£₹.+-]+/g) ?? []).map((w) => w.replace(/[.]+$/, '')).filter((w) => w && !MINOR.has(w));

/**
 * The user's result, as the words a rewrite must keep (owner, 2026-11-04, toreview §167): the last
 * clause that holds a number ("cutting the time it took by about 10%"), less its leading verb.
 */
function resultWords(figure: string): string[] {
  const clause = figure.split(/,\s+|;\s+/).filter((c) => /\d/.test(c)).at(-1) ?? figure;
  return words(clause).slice(1);
}

/** A rewrite that says the same result: every word of it, number included ("ledger API p99 latency 45%"). */
const keepsResult = (text: string, figure: string) => {
  const have = new Set(words(text));
  return resultWords(figure).every((w) => have.has(w));
};

/**
 * A figure the user wrote stays (toreview §129): when a rewrite of the role lost it, or changed what
 * it measured ("the time it took" became "build time", toreview §167), the user's own line takes the
 * place of the first line that cited it, or joins the role when none did. The base already carries
 * the figure.
 */
export function keepFigures(role: CanonicalRoleJson, next: CanonicalRoleJson, figures: NonNullable<TailorRunInput['figures']>, ri: number): CanonicalRoleJson {
  let bullets = next.bullets;
  for (const figure of figures.filter((f) => f.where === role.roleId)) {
    const fact = `${role.roleId}#r${figure.line}`;
    const line = role.bullets[figure.line];
    if (!line) continue;
    const citing = bullets.filter((b) => b.evidence.includes(fact));
    if (citing.some((b) => isQuantified(b.text, TAXONOMY) && keepsResult(b.text, line.text))) continue;
    const own = kept(line, `kept-${ri}-${figure.line}`, fact);
    const at = bullets.findIndex((b) => b.evidence.includes(fact));
    bullets = at < 0 ? [...bullets, own] : bullets.flatMap((b, i) => (i === at ? [own] : b.evidence.includes(fact) ? [] : [b]));
  }
  return bullets === next.bullets ? next : { ...next, bullets };
}
