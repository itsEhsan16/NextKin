import { resolveSkill, skillById, type Taxonomy } from '@nextkin/engines/normalizer';
import { phraseKey } from '@nextkin/engines/text';

import type { CanonicalResumeJson } from '../schemas/resumeContent';

type Groups = NonNullable<CanonicalResumeJson['skillGroups']>;

/** A line name that holds whatever fits nowhere else: "Practices & Tools", "Other", "Also". */
const CATCH_ALL = /\b(?:practices?|tools?|others?|also|additional|misc|general|soft)\b/i;

const words = (text: string) => new Set(phraseKey(text).split(' ').filter((w) => w.length >= 3));

/**
 * Which side of the stack a skill is on, where the taxonomy's category can't tell (toreview §170:
 * React and Spring Boot are both `framework`, so Spring Boot landed under "Front End").
 */
type Side = 'front' | 'back' | 'test';
const SIDES: Record<string, Side> = Object.fromEntries([
  ...['react', 'react-native', 'angular', 'angularjs', 'vue', 'nextjs', 'svelte', 'ember', 'jquery', 'backbone', 'redux', 'tailwind', 'bootstrap', 'sass', 'flutter'].map((id) => [id, 'front' as const]),
  ...['nodejs', 'express', 'django', 'flask', 'fastapi', 'spring', 'spring-boot', 'rails', 'laravel', 'dotnet', 'aspnet', 'graphql', 'grpc'].map((id) => [id, 'back' as const]),
  ...['jest', 'junit', 'mockito', 'cypress', 'playwright', 'selenium', 'pytest', 'mocha'].map((id) => [id, 'test' as const]),
]);
const LABEL_SIDES: [Side, RegExp][] = [
  ['test', /\btest(?:s|ing)?\b|\bqa\b/i],
  ['back', /\bback[\s-]?end\b|\bbackend\b|\bserver\b|\bapis?\b/i],
  ['front', /\bfront[\s-]?end\b|\bfrontend\b|\bui\b|\bclient\b/i],
];
const sideOfLabel = (label: string): Side | undefined => LABEL_SIDES.find(([, re]) => re.test(label))?.[0];

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
  // A line named for the keyword's side of the stack ("Back End & APIs", "Testing") comes first; a
  // line named for the other side never takes it by category.
  const side = ref.known ? SIDES[ref.id] : undefined;
  if (side) {
    const own = groups.findIndex((g) => sideOfLabel(g.label) === side);
    if (own >= 0) return own;
  }
  const category = ref.known ? skillById(taxonomy, ref.id)?.category : undefined;
  if (category) {
    const fits = (g: Groups[number]) => !side || !sideOfLabel(g.label) || sideOfLabel(g.label) === side;
    const byCategory = best((g) => (fits(g) ? g.names.filter((n) => { const r = resolveSkill(taxonomy, n); return r.known && skillById(taxonomy, r.id)?.category === category; }).length : 0));
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

/**
 * The file's skill lines tidied (toreview §170): lines with the same label become one, and a skill
 * listed twice (by canonical skill, else by its words) stays only where it first appears. Lines
 * left empty go. Pure.
 */
export function tidyGroups(groups: Groups, taxonomy: Taxonomy): Groups {
  const out: Groups = [];
  const seen = new Set<string>();
  for (const g of groups) {
    const key = phraseKey(g.label);
    const line = out.find((o) => phraseKey(o.label) === key) ?? (out.push({ label: g.label, names: [] }), out[out.length - 1]!);
    for (const name of g.names) {
      const id = resolveSkill(taxonomy, name).id;
      if (seen.has(id)) continue;
      seen.add(id);
      line.names.push(name);
    }
  }
  return out.filter((g) => g.names.length > 0);
}
