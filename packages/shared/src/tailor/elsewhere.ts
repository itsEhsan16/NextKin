import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { evidenceOf, type ScoringDocument } from '@nextkin/engines/document';
import { findSkill, resolveSkill, type SkillRef } from '@nextkin/engines/normalizer';
import { phraseIndex, phraseMentions } from '@nextkin/engines/phrases';
import { evidenceTier } from '@nextkin/engines/requirements';
import { phraseKey } from '@nextkin/engines/text';

import type { KeywordElsewhere, TailorKeyword } from '../models/tailor';

/**
 * "You already have this" (owner, 2026-11-15; toreview §206.3). A tailored run reads only the
 * resume it starts from, so a skill the candidate has recorded anywhere else — on their profile,
 * on another of their resumes, on a certificate — showed up as "missing" with nothing to say it
 * was theirs. Here each missing keyword is looked for in those records, by the same reading the
 * score uses (canonical skills, whole phrases, never a substring), and the row says where it was
 * found.
 *
 * It only ever points at the candidate's own records, and only offers: nothing is added until
 * they tick it, exactly as with any other keyword (D-14, G13). Where the record is a role this
 * resume also has, the tick places it there as the candidate's own word, because their own
 * profile already says they used it in that role.
 */

export type ElsewhereSource = {
  from: 'profile' | 'resume';
  /** How the source is named on screen: "your profile", or the other resume's title. */
  label: string;
  document: ScoringDocument;
};

/** A role of the resume being tailored, to line a record's role up with. */
export type OwnRole = { id: string; title: string; company: string };

const sameRole = (a: { title: string; company: string }, b: { title: string; company: string }) =>
  phraseKey(a.company) === phraseKey(b.company) && phraseKey(a.title) === phraseKey(b.title);

/** Whether a text names the skill: a known skill by any alias, an unknown phrase as whole words. */
function names(text: string, ref: SkillRef): boolean {
  if (!text.trim()) return false;
  return ref.known ? findSkill(TAXONOMY, text, ref).length > 0 : phraseMentions(text, phraseIndex([ref.id])).length > 0;
}

/** The line of a role that shows the skill, for the row to quote. */
const lineFor = (bullets: readonly string[], ref: SkillRef): string | undefined => bullets.find((line) => names(line, ref))?.trim().slice(0, 240);

// A role beats a certificate beats a bare skills-list entry; the profile beats another resume.
const RANK: Record<KeywordElsewhere['shown'], number> = { experience: 0, certificate: 1, listed: 2 };

export function elsewhereFor(args: {
  keywords: readonly TailorKeyword[];
  sources: readonly ElsewhereSource[];
  /** Certificates the candidate holds, by name (profile certifications, uploaded certificates). */
  certificates?: readonly string[];
  /** The roles of the resume being tailored. */
  roles: readonly OwnRole[];
}): Record<string, KeywordElsewhere> {
  const missing = args.keywords.filter((k) => !k.onResume && k.kind !== 'soft');
  if (missing.length === 0) return {};
  const refs = missing.map((k) => ({ label: k.label, ref: resolveSkill(TAXONOMY, k.label) }));
  const phrases = refs.flatMap(({ ref }) => (ref.known ? [] : [ref.id]));
  const read = args.sources.map((source) => ({ source, evidence: evidenceOf(source.document, TAXONOMY, { minCopiedWords: 8, phrases }).evidence }));

  const out: Record<string, KeywordElsewhere> = {};
  for (const { label, ref } of refs) {
    const found: KeywordElsewhere[] = [];
    for (const { source, evidence } of read) {
      const { tier, roleIds } = evidenceTier(evidence, ref.id);
      if (tier === 'demonstrated') {
        const role = source.document.roles.find((r) => r.id === roleIds[0]);
        if (!role) continue;
        const own = args.roles.find((r) => sameRole(r, role));
        const line = lineFor(role.bullets, ref);
        found.push({ from: source.from, shown: 'experience', in: `${role.title} at ${role.company}`, source: source.label, ...(own ? { where: own.id } : {}), ...(line ? { line } : {}) });
      } else if (tier === 'listed') {
        found.push({ from: source.from, shown: 'listed', in: source.label, source: source.label });
      }
    }
    const certificate = (args.certificates ?? []).find((name) => names(name, ref));
    if (certificate) found.push({ from: 'certificate', shown: 'certificate', in: certificate.trim().slice(0, 160), source: 'your certificates' });
    // Stable: the sources come profile first, so equal ranks keep the profile.
    const best = [...found].sort((a, b) => RANK[a.shown] - RANK[b.shown])[0];
    if (best) out[label] = best;
  }
  return out;
}

/** The places on this resume a record backs, by keyword: what a tick takes as the user's own. */
export function backedPlaces(elsewhere: Readonly<Record<string, KeywordElsewhere>>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [label, e] of Object.entries(elsewhere)) if (e.where) out[label] = [e.where];
  return out;
}

/** The row's line: where the candidate's own records show this keyword. */
export function elsewhereNote(e: KeywordElsewhere): string {
  if (e.shown === 'certificate') return `You hold ${e.in}.`;
  if (e.shown === 'listed') return e.from === 'profile' ? 'In your profile’s skills, not on this resume.' : `In the skills of “${e.in}”, not on this resume.`;
  const origin = e.from === 'profile' ? 'On your profile' : `On “${e.source}”`;
  return e.where ? `${origin}: ${e.in}. Not said on this resume yet.` : `${origin}: ${e.in}, a role this resume leaves out.`;
}
