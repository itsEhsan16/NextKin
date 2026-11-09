import { phraseKey } from '@nextkin/engines/text';

import type { CanonicalResumeJson } from '../schemas/resumeContent';

/**
 * The header's statements, checked against one job (toreview §170). A header item is either
 * contact (a phone, an email, a link, the user's own place) or a statement the user wrote about
 * themselves ("Open to relocating to Lucknow", "Seeking data analyst roles"). Contact is never
 * judged and never leaves the server (G5); a statement that does not fit this job is offered in
 * Enhance as Keep / Remove / Change. The user decides: what they are willing to do is theirs.
 */

type Header = NonNullable<CanonicalResumeJson['header']>;

const STATEMENT = /\b(?:open to|willing|relocat\w*|available|availability|notice period|immediate(?:ly)? join\w*|seeking|looking for|interested in|authori[sz]ed|visa|sponsorship|remote|hybrid|on-?site)\b/i;
const CONTACT = /@|\+?\d[\d\s().-]{6,}\d|https?:|www\.|\b(?:linkedin|github|portfolio|behance|dribbble|leetcode)\b/i;
const RELOCATION = /\brelocat\w*\b(?:\s+(?:to|in))?\s+(.+)$/i;
const TARGET_ROLE = /\b(?:seeking|looking for|interested in)\b\s+(?:an?\s+)?(.+?)(?:\s+(?:roles?|positions?|opportunit(?:y|ies)))?\.?$/i;

/** A header statement, by its index in `header.items`: never a contact item. */
export function headerStatements(header: Header | undefined): { index: number; text: string }[] {
  return (header?.items ?? []).flatMap((item, index) => (!item.url && !CONTACT.test(item.text) && STATEMENT.test(item.text) ? [{ index, text: item.text }] : []));
}

export type HeaderCheck = {
  index: number;
  text: string;
  kind: 'relocation_elsewhere' | 'other_role';
  /** What the line would say for this job, offered as "Change"; absent when there is nothing to offer. */
  suggestion?: string;
};

const words = (text: string) => new Set(phraseKey(text).split(' ').filter((w) => w.length >= 3));
const overlaps = (a: string, b: string) => {
  const bw = words(b);
  return [...words(a)].some((w) => bw.has(w));
};

/** The job's city, read off its location line ("India - Pune" → "Pune"; "Pune, Maharashtra" → "Pune"). */
export function jobCityOf(location: string | undefined | null): string | undefined {
  if (!location?.trim()) return undefined;
  const parts = location.split(/\s[-–|]\s|,|\//).map((p) => p.trim()).filter(Boolean);
  const named = parts.filter((p) => !/^(?:india|usa|us|united states|uk|united kingdom|remote|hybrid|on-?site)$/i.test(p));
  return named.length ? (location.includes(',') ? named[0] : named[named.length - 1]) : undefined;
}

/**
 * The statements that do not fit this job: relocating to a place the job is not in, or seeking a
 * role that shares no word with the job's title. Pure.
 */
export function headerChecksFor(header: Header | undefined, job: { title: string; location?: string | null }): HeaderCheck[] {
  const city = jobCityOf(job.location);
  return headerStatements(header).flatMap(({ index, text }): HeaderCheck[] => {
    const relocation = RELOCATION.exec(text)?.[1]?.replace(/[.;]+$/, '').trim();
    if (relocation && city && !overlaps(relocation, job.location ?? '')) {
      return [{ index, text, kind: 'relocation_elsewhere', suggestion: text.slice(0, text.length - relocation.length) + city }];
    }
    const role = TARGET_ROLE.exec(text)?.[1]?.trim();
    if (role && !relocation && !overlaps(role, job.title)) return [{ index, text, kind: 'other_role' }];
    return [];
  });
}

/**
 * True when a header statement plainly serves this job, so the review may not take it out (§202):
 * relocating to a place the job's location names, or seeking a role that shares a word with the
 * job's title. Anything else ("Open to relocating to Lucknow" for a job that names no place) is the
 * review's call, shown in "What changed" with Restore. Pure.
 */
export function statementFitsJob(text: string, job: { title: string; location?: string | null }): boolean {
  const relocation = RELOCATION.exec(text)?.[1]?.replace(/[.;]+$/, '').trim();
  if (relocation) return Boolean(job.location?.trim()) && overlaps(relocation, job.location ?? '');
  const role = TARGET_ROLE.exec(text)?.[1]?.trim();
  return role ? overlaps(role, job.title) : false;
}

/** The user's answer to one check: remove the line, or replace it with text they accepted. */
export type HeaderChoice = { index: number; action: 'remove' | 'replace'; text?: string };

/** The header with the user's choices applied; an index no statement has is ignored. Pure. */
export function withHeaderChoices(header: Header | undefined, choices: readonly HeaderChoice[]): Header | undefined {
  if (!header || choices.length === 0) return header;
  const statements = new Set(headerStatements(header).map((s) => s.index));
  const byIndex = new Map(choices.filter((c) => statements.has(c.index)).map((c) => [c.index, c]));
  const items = header.items.flatMap((item, i) => {
    const choice = byIndex.get(i);
    if (!choice) return [item];
    if (choice.action === 'remove') return [];
    return choice.text?.trim() ? [{ text: choice.text.trim().slice(0, 200) }] : [item];
  });
  return { ...header, items };
}
