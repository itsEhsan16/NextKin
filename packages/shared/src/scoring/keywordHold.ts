import type { CanonicalResumeJson } from '../schemas/resumeContent';

/**
 * How well a resume holds a job's phrases, counted the way an outside keyword checker counts them
 * (owner, 2026-11-25): the job's own words, letter for letter, and how often. Two runs of one
 * resume for one job scored 84 and 74 on such a checker while the rubric gave both the same
 * points: the rubric credits a skill under any spelling the taxonomy knows, and counts repeats
 * only for terms a job says three times. This is the stricter count, for comparing two versions of
 * one text: a rewrite or an edit that holds fewer of the job's phrases is the worse one. Pure.
 */

export interface HoldTerm {
  /** The phrase as the job writes it. */
  term: string;
  /** How many times a resume should say it: as often as the job does, at most twice. */
  want: number;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** How many times `text` says `term` as whole words, any case ("Go" is not in "good"). */
export function mentionsOf(text: string, term: string): number {
  const phrase = term.trim();
  if (!phrase) return 0;
  return (text.match(new RegExp(`(?<![\\p{L}\\p{N}])${escape(phrase)}(?![\\p{L}\\p{N}])`, 'giu')) ?? []).length;
}

/** The job's phrases, each once, with how often a resume should say it. */
export function holdTerms(job: { skills: readonly string[]; rawText?: string | null }): HoldTerm[] {
  const seen = new Set<string>();
  const out: HoldTerm[] = [];
  for (const raw of job.skills) {
    const term = raw.trim();
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    out.push({ term, want: Math.min(2, Math.max(1, mentionsOf(job.rawText ?? '', term))) });
  }
  return out;
}

/** Everything a checker reads off the page: headline, summary, skills, every line. */
export function pageWords(doc: CanonicalResumeJson): string {
  return [
    doc.headline,
    doc.summary?.text,
    doc.skills.map((s) => s.name).join(', '),
    ...doc.roles.flatMap((r) => [r.title, ...r.bullets.map((b) => b.text)]),
    ...doc.projects.flatMap((p) => [p.name, p.tech, ...p.bullets.map((b) => b.text)]),
    ...(doc.sections ?? []).flatMap((s) => [...s.lines.map((l) => l.text), ...s.entries.flatMap((e) => [e.title, e.subtitle, ...e.bullets.map((b) => b.text)])]),
  ]
    .filter(Boolean)
    .join('\n');
}

export interface Hold {
  /** The sum over the job's phrases of how many of the wanted mentions the text has. */
  held: number;
  /** The phrases the text says, but less often than the job does. */
  short: { term: string; have: number; want: number }[];
  /** The phrases the text never says. */
  missing: string[];
}

export function holdOfText(text: string, terms: readonly HoldTerm[]): Hold {
  let held = 0;
  const short: Hold['short'] = [];
  const missing: string[] = [];
  for (const { term, want } of terms) {
    const have = mentionsOf(text, term);
    held += Math.min(have, want);
    if (have === 0) missing.push(term);
    else if (have < want) short.push({ term, have, want });
  }
  return { held, short, missing };
}

export const holdOf = (doc: CanonicalResumeJson, terms: readonly HoldTerm[]): Hold => holdOfText(pageWords(doc), terms);
