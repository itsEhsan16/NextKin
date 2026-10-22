/**
 * The canonical document the rubric scores, and how evidence is read out of it (P8-06, P8-07).
 *
 * The scorer never sees a name, a photo, an age, a nationality or a contact value: contact is three
 * booleans, so protected attributes cannot move a score (P8-09) and no contact detail enters the
 * engines at all (G5). A generated resume and an upload both arrive in this shape; so does a profile
 * when it is the yardstick.
 */

import { type DatedSpan } from './dates';
import { mentionsIn, resolveSkill, type Taxonomy } from './normalizer';
import { phraseIndex, phraseMentions } from './phrases';
import type { Evidence, EvidenceRole } from './requirements';
import { copiedRanges, insideAny, type Range } from './text';

export interface ScoringRole extends DatedSpan {
  id: string;
  title: string;
  company: string;
  bullets: readonly string[];
  /** Skills tagged on the role (profile tags; a generated role's evidence). */
  skills?: readonly string[];
}

export interface ScoringDocument {
  headline?: string;
  summary?: string;
  skills: readonly string[];
  roles: readonly ScoringRole[];
  education: readonly { institution: string; degree: string }[];
  certifications?: readonly string[];
  projects?: readonly { name: string; description?: string; bullets: readonly string[] }[];
  /** Whether each contact detail is present. Never the values. */
  contact: { email: boolean; phone: boolean; location: boolean };
  links?: readonly string[];
}

/**
 * The layout facts the formatting component reads. For a generated document they come from its
 * template's certification (P10, Q-06); for an upload, from the analyzer (P7). Date consistency is
 * computed from the roles when not given.
 */
export interface FormatFacts {
  singleColumn: boolean;
  standardHeadings: boolean;
  noTablesOrImages: boolean;
  standardFonts: boolean;
  contactInBody: boolean;
  consistentDates?: boolean;
}

/** A run of text copied from the JD, reported and given no credit (G16). */
export interface CopiedText {
  roleId?: string;
  text: string;
}

export interface DocumentEvidence {
  evidence: Evidence;
  copied: CopiedText[];
}

export function roleText(role: Pick<ScoringRole, 'title' | 'bullets'>): string {
  return [role.title, ...role.bullets].join('\n');
}

/**
 * Evidence from a document: each role's tags and the skills its own text mentions, then everything
 * named outside a dated role. Mentions inside text copied from the JD are dropped. `phrases` are
 * the JD's requirements the taxonomy does not know (`x:` ids), found in the text as whole words.
 */
export function evidenceOf(
  document: ScoringDocument,
  taxonomy: Taxonomy,
  options: { jdText?: string; minCopiedWords: number; removed?: ReadonlySet<string>; phrases?: Iterable<string> } = { minCopiedWords: 8 },
): DocumentEvidence {
  const copied: CopiedText[] = [];
  const surfaces: Record<string, string> = {};
  const removed = options.removed ?? new Set<string>();
  const phrases = phraseIndex(options.phrases ?? []);
  const named = (written: string) => phraseMentions(written, phrases).map((m) => m.id);

  const read = (text: string, roleId?: string): string[] => {
    const ranges: Range[] = options.jdText ? copiedRanges(text, options.jdText, options.minCopiedWords) : [];
    for (const range of ranges) copied.push({ ...(roleId ? { roleId } : {}), text: text.slice(range.start, range.end) });
    const skills = mentionsIn(taxonomy, text).map((m) => ({ id: m.skillId, start: m.start, end: m.end, surface: m.surface }));
    return [...skills, ...phraseMentions(text, phrases)]
      .filter((m) => !insideAny(m.start, m.end, ranges))
      .map((m) => {
        surfaces[m.id] ??= m.surface;
        return m.id;
      });
  };

  // The skills section first: its wording is the one to mirror.
  const listed = new Set<string>();
  for (const written of document.skills) {
    const ref = resolveSkill(taxonomy, written);
    surfaces[ref.id] ??= written.trim();
    listed.add(ref.id);
    for (const id of named(written)) listed.add(id);
  }

  const roles: EvidenceRole[] = document.roles.map((role) => {
    const ids = new Set<string>();
    for (const written of role.skills ?? []) {
      const ref = resolveSkill(taxonomy, written);
      surfaces[ref.id] ??= written.trim();
      ids.add(ref.id);
      for (const id of named(written)) ids.add(id);
    }
    for (const id of read(roleText(role), role.id)) ids.add(id);
    const kept = [...ids].filter((id) => !removed.has(`${role.id}\u0000${id}`));
    return { id: role.id, ...(role.start !== undefined ? { start: role.start } : {}), ...(role.end !== undefined ? { end: role.end } : {}), skills: kept };
  });

  const loose = [document.headline ?? '', document.summary ?? '', ...(document.projects ?? []).flatMap((p) => [p.name, p.description ?? '', ...p.bullets])];
  for (const text of loose) for (const id of read(text)) listed.add(id);

  return { evidence: { roles, listed: [...listed], surfaces }, copied };
}

/** Every skill id the document shows anywhere. */
export function allSkillIds(evidence: Evidence): Set<string> {
  return new Set([...evidence.listed, ...evidence.roles.flatMap((r) => r.skills)]);
}
