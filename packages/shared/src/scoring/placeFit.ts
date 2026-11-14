import type { PartialDate } from '@nextkin/engines/dates';
import { KB } from '@nextkin/engines/datasets/kb';
import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { kbEntry, TECHNOLOGY_CATEGORIES } from '@nextkin/engines/kb';
import { mentionsIn, resolveSkill, skillById } from '@nextkin/engines/normalizer';
import { wordKeys } from '@nextkin/engines/text';
import { validateTimeline } from '@nextkin/engines/timeline';

import type { ResumeContent } from '../models/resumeContent';
import type { CanonicalResumeJson } from '../schemas/resumeContent';
import { roleDates } from './adapters';

/**
 * Where a ticked keyword fits on this resume, decided before the user ticks it (owner, 2026-11-03,
 * toreview §163). Every role and project is a candidate, scored by how close its own lines are:
 * - it already names the skill (100);
 * - it uses a skill the KB relates to it (4 each, both ways);
 * - the keyword's words appear in its lines, lightly stemmed so "webhooks" meets "webhook" (3 each);
 * - it uses a technology of the same kind (2 each), for technologies only.
 * A dated role must also pass the timeline engine for the skill; a project has no dates to judge.
 * Places scoring at least 2 and at least half the best are picked, best first, at most three.
 * No fit picks nothing: the keyword goes in Skills only (no fallback to the latest role).
 */

export interface FitPlace {
  id: string;
  text: string;
  skills: readonly string[];
  /** A role's dates; a project has none. */
  start?: PartialDate | null;
  end?: PartialDate | null;
}

const MAX_PICKS = 3;
const MIN_SCORE = 2;
// Words too common to say a place fits: "LLM APIs" must not land on a project for its "REST APIs".
const STOP = new Set([
  'and', 'or', 'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'api', 'data', 'tool',
  'system', 'platform', 'service', 'app', 'application', 'feature', 'management', 'development',
  'developer', 'web', 'website', 'software', 'solution', 'project', 'business', 'operation',
  'internal', 'online', 'live', 'real', 'time', 'based', 'using', 'work', 'database',
]);
// Only kinds narrow enough that sharing one says something ("tool" and "devops" are too broad).
const NEAR_KINDS = new Set(['language', 'framework', 'library', 'database', 'cloud']);

/** "webhooks" → "webhook", "dashboards" → "dashboard", "automation" stays. */
const stem = (word: string) =>
  word.length > 4 && word.endsWith('ies') ? `${word.slice(0, -3)}y` : word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
const words = (text: string) => wordKeys(text).map(stem).filter((w) => !STOP.has(w));
/** The same word, or one form of the other: "integrations" meets "integrated" (six letters alike). */
const sameWord = (a: string, b: string) => a === b || (a.length >= 6 && b.length >= 6 && a.slice(0, 6) === b.slice(0, 6));

/** Whether the technology existed while the place ran (a project has no dates, so it passes). */
export const placeFitsEra = (place: FitPlace, keyword: string, asOf: PartialDate | undefined): boolean => fitsEra(place, keyword, asOf);
/** How close a place's own lines sit to a keyword: 0 is nothing in common. */
export const placeCloseness = (place: FitPlace, keyword: string): number => closeness(place, keyword);

function fitsEra(place: FitPlace, keyword: string, asOf: PartialDate | undefined): boolean {
  if (!place.start || place.end === undefined || !asOf) return true;
  const report = validateTimeline({ roles: [{ id: place.id, start: place.start, end: place.end, skills: [keyword] }], kb: KB, taxonomy: TAXONOMY, asOf });
  return report.pairs.every((p) => p.included);
}

function closeness(place: FitPlace, keyword: string): number {
  const ref = resolveSkill(TAXONOMY, keyword);
  const own = new Set([...place.skills.map((s) => resolveSkill(TAXONOMY, s).id), ...mentionsIn(TAXONOMY, place.text).map((m) => m.skillId)]);
  if (own.has(ref.id)) return 100;
  const related = new Set(kbEntry(KB, ref.id)?.related ?? []);
  const relatedUse = [...own].filter((id) => related.has(id) || kbEntry(KB, id)?.related?.includes(ref.id)).length;
  const category = skillById(TAXONOMY, ref.id)?.category;
  const sameKind = category && TECHNOLOGY_CATEGORIES.has(category) && NEAR_KINDS.has(category) ? [...own].filter((id) => id !== ref.id && skillById(TAXONOMY, id)?.category === category).length : 0;
  const placeWords = [...new Set(words(place.text))];
  const overlap = [...new Set(words(keyword))].filter((w) => placeWords.some((p) => sameWord(w, p))).length;
  return relatedUse * 4 + overlap * 3 + sameKind * 2;
}

/** The ids of the places this keyword fits, best first; empty when none does. */
export function pickPlaces(keyword: string, places: readonly FitPlace[], asOf?: PartialDate): string[] {
  const scored = places
    .filter((p) => fitsEra(p, keyword, asOf))
    .map((p) => ({ id: p.id, score: closeness(p, keyword) }))
    .filter((p) => p.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
  const best = scored[0]?.score ?? 0;
  return scored.filter((p) => p.score * 2 >= best).slice(0, MAX_PICKS).map((p) => p.id);
}

const splitTech = (tech: string | undefined) => (tech ?? '').split(/\s*[,|/]\s*/).map((s) => s.trim()).filter(Boolean);

/** A resume's places as the picker reads them, with the ids `placesOf` gives. */
export const fitPlacesOf = (doc: CanonicalResumeJson): FitPlace[] => [
  ...doc.roles.map((r) => {
    const { start, end } = roleDates({ start: r.start ?? undefined, end: r.end, period: '' });
    return { id: r.roleId, text: [r.title, ...r.bullets.map((b) => b.text)].join('\n'), skills: r.skills, ...(start ? { start } : {}), ...(end !== undefined ? { end } : {}) };
  }),
  ...doc.projects.map((p) => {
    const tech = splitTech(p.tech);
    return { id: `project:${p.factId}`, text: [p.name, p.description ?? '', ...p.bullets.map((b) => b.text), ...tech].join('\n'), skills: tech };
  }),
];

/** The same from a resume as the apps hold it (the mock's comparisons), as `placesOfContent` ids them. */
export const fitPlacesOfContent = (body: Pick<ResumeContent, 'experience' | 'projects'>): FitPlace[] => [
  ...body.experience.map((r) => {
    const { start, end } = roleDates(r);
    return { id: r.roleId ?? r.id, text: [r.title, ...r.bullets].join('\n'), skills: r.skills ?? [], ...(start ? { start } : {}), ...(end !== undefined ? { end } : {}) };
  }),
  ...body.projects.map((p) => ({ id: `project:${p.id}`, text: [p.name, p.description, ...p.bullets].join('\n'), skills: [] })),
];

/** Every missing skill keyword's picks, for the comparison (soft skills have no place). */
export function picksFor(keywords: readonly { label: string; onResume: boolean; kind?: string }[], places: readonly FitPlace[], asOf?: PartialDate): Record<string, string[]> {
  const picks: Record<string, string[]> = {};
  for (const k of keywords) {
    if (k.onResume || k.kind === 'soft') continue;
    const ids = pickPlaces(k.label, places, asOf);
    if (ids.length) picks[k.label] = ids;
  }
  return picks;
}
