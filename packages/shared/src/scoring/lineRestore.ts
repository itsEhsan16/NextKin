import type { ResumeDocument, ResumeDocumentWrite } from '../models/resumeDocument';

/**
 * A line the tailor's review took out because it doesn't serve the job (owner, 2026-11-09, §202):
 * where it sat, so "What changed" can put it back with one tap. A header statement by its index
 * in the header's items, a summary sentence by its index among the summary's sentences, a bullet
 * by its role's or project's id and its place in that list.
 */
export type LineRestore =
  | { at: 'header'; index: number; text: string }
  | { at: 'summary'; index: number; text: string }
  | { at: 'bullet'; owner: string; index: number; text: string };

/**
 * The summary's sentences. A break is a full stop, "!" or "?" followed by a space and a capital or
 * a digit, and not after "e.g." or "etc.", so "Node.js" and "e.g. Express" stay in their sentence.
 */
export function summarySentences(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .trim()
    .split(/(?<!\b(?:e\.g|i\.e|etc|vs|incl|approx)\.)(?<=[.!?])\s+(?=["“(]?[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const bulletsOf = (doc: Pick<ResumeDocument, 'experience' | 'projects'>, owner: string) =>
  doc.experience.find((r) => r.id === owner)?.bullets ?? doc.projects.find((p) => p.id === owner)?.bullets;

/** True when the line is on the document again (or never left): Restore has nothing to do. */
export function isRestored(doc: Pick<ResumeDocument, 'header' | 'summary' | 'experience' | 'projects'>, line: LineRestore): boolean {
  if (line.at === 'header') return doc.header.items.some((i) => same(i.text, line.text));
  if (line.at === 'summary') return summarySentences(doc.summary).some((s) => same(s, line.text));
  const role = doc.experience.find((r) => r.id === line.owner);
  const all = role ? [...role.bullets, ...role.groups.flatMap((g) => g.bullets)] : (bulletsOf(doc, line.owner) ?? []);
  return all.some((b) => same(b.text, line.text));
}

/**
 * The document with the line back where it was (its place clamped to what is there now), as the
 * editor's save sends it; null when its role or project is no longer on the resume. Pure.
 */
export function restoreLine(doc: ResumeDocument, line: LineRestore): ResumeDocumentWrite | null {
  const { resumeId: _r, versionId: _v, revision: _rev, pendingReview: _p, ...write } = doc;
  const insert = <T,>(list: readonly T[], index: number, item: T) => {
    const at = Math.max(0, Math.min(index, list.length));
    return [...list.slice(0, at), item, ...list.slice(at)];
  };
  const id = `restored-${line.at}-${line.index}`;
  if (line.at === 'header') {
    return { ...write, header: { ...write.header, items: insert(write.header.items, line.index, { id, text: line.text }) } };
  }
  if (line.at === 'summary') {
    return { ...write, summary: insert(summarySentences(write.summary), line.index, line.text.trim()).join(' ') };
  }
  const bullet = { id, text: line.text };
  if (write.experience.some((r) => r.id === line.owner)) {
    return { ...write, experience: write.experience.map((r) => (r.id === line.owner ? { ...r, bullets: insert(r.bullets, line.index, bullet) } : r)) };
  }
  if (write.projects.some((p) => p.id === line.owner)) {
    return { ...write, projects: write.projects.map((p) => (p.id === line.owner ? { ...p, bullets: insert(p.bullets, line.index, bullet) } : p)) };
  }
  return null;
}
