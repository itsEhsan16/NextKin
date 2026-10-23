import type { CanonicalResumeJson } from '@nextkin/shared/schemas/resumeContent';

import type { Verdict } from './crossCheck';
import type { Extraction } from './extract';

/**
 * The page structure of an uploaded resume, kept only as far as the file states it (toreview §111):
 * a role's client projects, the skills section's labelled lines, sections beyond the standard six,
 * and the order and wording of the headings. Each piece is checked against the file's text like
 * every line the cross-check keeps: a label, a title or a heading the file never prints is dropped
 * and listed, never typeset.
 */

export interface CheckContext {
  /** The phrase appears as written, or (almost) all of its words appear. */
  found(phrase: string, coverage: number): boolean;
  /** The text appears in the file as written (case, spacing and punctuation aside). */
  verbatim(text: string): boolean;
  /** Lines kept word for word, each only once in the whole document; the rest are listed. */
  keepLines(lines: readonly string[], section: string): string[];
  rejected: Verdict[];
}

const userLine = (id: string, text: string) => ({ id, text: text.trim(), evidence: [] as string[], origin: 'user' as const });

type Role = CanonicalResumeJson['roles'][number];
type Entries = NonNullable<Role['entries']>;

/** A role's client projects: their lines join the role's bullets, grouped by id. */
export function roleEntries(ctx: CheckContext, entries: Extraction['roles'][number]['entries'], roleIndex: number, own: number): { bullets: Role['bullets']; entries: Entries } {
  const bullets: Role['bullets'] = [];
  const out: Entries = [];
  for (const entry of entries) {
    if (!ctx.found(entry.title, 0.8)) {
      ctx.rejected.push({ section: 'experience', item: entry.title.slice(0, 120), reason: 'The document does not name this project.' });
      continue;
    }
    const ids: string[] = [];
    for (const line of ctx.keepLines(entry.bullets, 'experience')) {
      if (own + bullets.length >= 12) break;
      const id = `u-b${roleIndex}-${own + bullets.length}`;
      bullets.push(userLine(id, line));
      ids.push(id);
    }
    const tech = entry.tech && ctx.verbatim(entry.tech) ? entry.tech.trim().slice(0, 300) : undefined;
    if (ids.length) out.push({ title: entry.title.trim().slice(0, 200), ...(tech ? { tech } : {}), bulletIds: ids });
  }
  return { bullets, entries: out.slice(0, 6) };
}

/** The skills section's labelled lines, naming only skills the file mentions. */
export function skillGroupsOf(ctx: CheckContext, groups: Extraction['skillGroups'], skillFound: (s: string) => boolean): NonNullable<CanonicalResumeJson['skillGroups']> {
  const out: NonNullable<CanonicalResumeJson['skillGroups']> = [];
  for (const group of groups) {
    if (!ctx.verbatim(group.label)) {
      ctx.rejected.push({ section: 'skills', item: group.label.slice(0, 120), reason: 'The document does not print this label.' });
      continue;
    }
    const names = group.skills.filter((s) => skillFound(s)).map((s) => s.trim().slice(0, 120));
    if (names.length) out.push({ label: group.label.trim().replace(/:$/, '').slice(0, 80), names: [...new Set(names)].slice(0, 40) });
  }
  return out.slice(0, 12);
}

/** Sections beyond the standard six, with only what the file states. */
export function extraSectionsOf(ctx: CheckContext, sections: Extraction['extraSections']): NonNullable<CanonicalResumeJson['sections']> {
  const out: NonNullable<CanonicalResumeJson['sections']> = [];
  sections.forEach((section, si) => {
    if (!ctx.verbatim(section.heading)) {
      ctx.rejected.push({ section: 'sections', item: section.heading.slice(0, 120), reason: 'The document does not print this heading.' });
      return;
    }
    const id = `s${si}`;
    const entries = section.entries.flatMap((e, ei) => {
      if (!ctx.found(e.title, 0.8)) return [];
      const subtitle = e.subtitle && ctx.verbatim(e.subtitle) ? e.subtitle.trim() : undefined;
      const right = e.right && ctx.verbatim(e.right) ? e.right.trim() : undefined;
      const bullets = ctx.keepLines(e.bullets, section.heading).slice(0, 8).map((line, j) => userLine(`u-x${si}-${ei}-${j}`, line));
      return [{ title: e.title.trim().slice(0, 200), ...(subtitle ? { subtitle: subtitle.slice(0, 200) } : {}), ...(right ? { right: right.slice(0, 80) } : {}), bullets }];
    });
    const lines = ctx.keepLines(section.lines, section.heading).slice(0, 12).map((line, j) => userLine(`u-x${si}-l${j}`, line));
    if (entries.length || lines.length) out.push({ id, heading: section.heading.trim().slice(0, 80), entries: entries.slice(0, 8), lines });
  });
  return out.slice(0, 6);
}

const KEYS: [RegExp, string][] = [
  [/summary|profile|objective|about/i, 'summary'],
  [/skill|competenc|technolog|expertise|tools/i, 'skills'],
  [/experience|employment|work history|career/i, 'experience'],
  [/project/i, 'projects'],
  [/education|academic|qualification/i, 'education'],
  [/certific|licen[cs]e|credential/i, 'certifications'],
];

/** The headings in the file's order, each mapped to its section, with its own wording. */
export function layoutOf(ctx: CheckContext, order: readonly string[], sections: NonNullable<CanonicalResumeJson['sections']>): CanonicalResumeJson['layout'] {
  const keys: string[] = [];
  const headings: Record<string, string> = {};
  for (const heading of order) {
    if (!ctx.verbatim(heading)) continue;
    const extra = sections.find((s) => s.heading.toLowerCase() === heading.trim().toLowerCase());
    const key = extra ? `x:${extra.id}` : KEYS.find(([re]) => re.test(heading))?.[1];
    if (!key || keys.includes(key)) continue;
    keys.push(key);
    headings[key] = heading.trim().slice(0, 80);
  }
  return keys.length ? { order: keys, headings } : undefined;
}
