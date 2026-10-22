import { resolveSkill, skillById, type Taxonomy } from '@nextkin/engines/normalizer';
import { phraseKey } from '@nextkin/engines/text';

import type { CanonicalResumeJson } from '../schemas/resumeContent';

type Groups = NonNullable<CanonicalResumeJson['skillGroups']>;

/** A line name that holds whatever fits nowhere else: "Practices & Tools", "Other", "Also". */
const CATCH_ALL = /\b(?:practices?|tools?|others?|also|additional|misc|general|soft)\b/i;

const words = (text: string) => new Set(phraseKey(text).split(' ').filter((w) => w.length >= 3));

/**
 * The file's skill line a new keyword belongs on (toreview §113, as Jobright puts "application
 * architecture" under Web Fundamentals): the line holding the most skills of the same taxonomy
 * category; else the one sharing the most words with it, in its label or its skills; else a
 * catch-all line; else the last. Pure; the index into `groups`, or -1 when there are none.
 */
export function groupFor(keyword: string, groups: Groups, taxonomy: Taxonomy): number {
  if (groups.length === 0) return -1;
  const best = (score: (g: Groups[number]) => number) => {
    let at = -1;
    let top = 0;
    groups.forEach((g, i) => {
      const s = score(g);
      if (s > top) [at, top] = [i, s];
    });
    return at;
  };
  const ref = resolveSkill(taxonomy, keyword);
  const category = ref.known ? skillById(taxonomy, ref.id)?.category : undefined;
  if (category) {
    const byCategory = best((g) => g.names.filter((n) => { const r = resolveSkill(taxonomy, n); return r.known && skillById(taxonomy, r.id)?.category === category; }).length);
    if (byCategory >= 0) return byCategory;
  }
  const own = words(keyword);
  const byWords = best((g) => [g.label, ...g.names].reduce((n, text) => n + [...words(text)].filter((w) => own.has(w)).length, 0));
  if (byWords >= 0) return byWords;
  const catchAll = groups.findIndex((g) => CATCH_ALL.test(g.label));
  return catchAll >= 0 ? catchAll : groups.length - 1;
}

/** The file's skill lines with each new keyword placed on its line, once. */
export function placeInGroups(groups: Groups, added: readonly string[], taxonomy: Taxonomy): Groups {
  const out = groups.map((g) => ({ ...g, names: [...g.names] }));
  const listed = new Set(out.flatMap((g) => g.names.map((n) => resolveSkill(taxonomy, n).id)));
  for (const keyword of added) {
    const id = resolveSkill(taxonomy, keyword).id;
    if (listed.has(id)) continue;
    const at = groupFor(keyword, out, taxonomy);
    // A line holds at most 40 skills (the schema's cap); a full one takes no more.
    if (at < 0 || out[at]!.names.length >= 40) continue;
    out[at]!.names.push(keyword);
    listed.add(id);
  }
  return out;
}
