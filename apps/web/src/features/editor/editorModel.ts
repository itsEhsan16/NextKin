import type {
  DocCustomEntry,
  DocCustomSection,
  DocEducation,
  DocLine,
  DocProject,
  DocRole,
  ResumeDocument,
  ResumeDocumentWrite,
} from '@nextkin/shared/models';

/**
 * The editor's small pure helpers (toreview §124): fresh ids and blank entries, list moves, and
 * the write a save sends. Ids made here are short and URL-safe, which the server keeps as they are.
 */

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${random}`.slice(0, 40);
}

export const blankLine = (): DocLine => ({ id: newId('l'), text: '' });

export const blankRole = (): DocRole => ({
  id: newId('r'),
  company: '',
  title: '',
  location: '',
  start: null,
  end: null,
  bullets: [blankLine()],
  groups: [],
});

export const blankProject = (): DocProject => ({
  id: newId('p'),
  name: '',
  description: '',
  tech: '',
  start: null,
  end: null,
  bullets: [blankLine()],
});

export const blankEducation = (): DocEducation => ({
  id: newId('e'),
  institution: '',
  degree: '',
  field: '',
  start: null,
  end: null,
  gpa: '',
  location: '',
});

export const blankCustomEntry = (): DocCustomEntry => ({
  id: newId('x'),
  title: '',
  subtitle: '',
  right: '',
  subRight: '',
  bullets: [],
});

export const blankCustomSection = (heading: string): DocCustomSection => ({
  id: newId('s').replace(/[^A-Za-z0-9_-]/g, ''),
  heading,
  entries: [],
  lines: [blankLine()],
});

/** The list with the item at `index` moved one place up (-1) or down (+1); unchanged at an edge. */
export function move<T>(list: readonly T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (to < 0 || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item as T);
  return next;
}

export function toWrite(doc: ResumeDocument): ResumeDocumentWrite {
  const {
    header,
    summary,
    skills,
    experience,
    projects,
    education,
    certifications,
    custom,
    order,
    headings,
    template,
  } = doc;
  return {
    header,
    summary,
    skills,
    experience,
    projects,
    education,
    certifications,
    custom,
    order,
    headings,
    template,
  };
}

/** Same content, ignoring the server's ids for the version: what "unsaved" compares. */
export const sameWrite = (a: ResumeDocumentWrite, b: ResumeDocumentWrite) =>
  JSON.stringify(a) === JSON.stringify(b);
