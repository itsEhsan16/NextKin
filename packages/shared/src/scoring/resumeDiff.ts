import type { ResumeContent } from '../models/resumeContent';

/**
 * What a tailored resume changed against the one it came from (toreview §113, Jobright's
 * highlighted lines), section by section: each line of a section that changed, marked new when the
 * base did not have it word for word. Sections that did not change are left out. Pure.
 */

export type DiffLine = { text: string; isNew: boolean };
export type DiffSection = { title: string; lines: DiffLine[] };

const norm = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

function section(title: string, before: readonly string[], after: readonly string[], onlyNew = false): DiffSection | null {
  const had = new Set(before.map(norm));
  const lines = after.filter((t) => t.trim()).map((text) => ({ text, isNew: !had.has(norm(text)) }));
  if (!lines.some((l) => l.isNew)) return null;
  return { title, lines: onlyNew ? lines.filter((l) => l.isNew) : lines };
}

export function resumeDiff(base: ResumeContent, next: ResumeContent): DiffSection[] {
  const out: (DiffSection | null)[] = [
    section('Headline', [base.headline ?? ''], [next.headline ?? '']),
    section('Summary', [base.summary], [next.summary]),
    // Only the skills that are new: the list itself is long, and its order is the job's.
    section('Skills added', base.skills, next.skills, true),
    ...next.experience.map((role) => {
      const before = base.experience.find((r) => (r.roleId ?? r.id) === (role.roleId ?? role.id));
      return section(`${role.title} · ${role.company}`, before?.bullets ?? [], role.bullets);
    }),
    ...next.projects.map((project) => {
      const before = base.projects.find((p) => p.id === project.id);
      return section(project.name, before?.bullets ?? [], project.bullets);
    }),
  ];
  return out.filter((s): s is DiffSection => s !== null);
}

/** Every section of the resume, each line marked new or kept, and whether the section changed. */
export type TextSection = DiffSection & { changed: boolean };

/**
 * The resume as text with what the run changed marked (toreview §121, "Text view"): every
 * section in the resume's order, not only the changed ones, so it reads as the whole document.
 */
export function resumeTextView(base: ResumeContent | undefined, next: ResumeContent): TextSection[] {
  const mark = (title: string, before: readonly string[], after: readonly string[]): TextSection | null => {
    const lines = after.filter((t) => t.trim());
    if (lines.length === 0) return null;
    const had = new Set(before.map(norm));
    const marked = lines.map((text) => ({ text, isNew: base !== undefined && !had.has(norm(text)) }));
    return { title, lines: marked, changed: marked.some((l) => l.isNew) };
  };
  const out: (TextSection | null)[] = [
    mark('Summary', [base?.summary ?? ''], [next.summary]),
    mark('Skills', base?.skills ?? [], next.skills.length ? [next.skills.join(', ')] : []),
    ...next.experience.map((role) => {
      const before = base?.experience.find((r) => (r.roleId ?? r.id) === (role.roleId ?? role.id));
      return mark(`${role.title} · ${role.company}`, before?.bullets ?? [], role.bullets);
    }),
    ...next.projects.map((project) => mark(project.name, base?.projects.find((p) => p.id === project.id)?.bullets ?? [], project.bullets)),
  ];
  // Skills read as one line: changed when any skill is new.
  const skills = out[1];
  if (skills && base) {
    const had = new Set(base.skills.map(norm));
    const added = next.skills.some((sk) => !had.has(norm(sk)));
    out[1] = { ...skills, changed: added, lines: skills.lines.map((l) => ({ ...l, isNew: false })) };
  }
  return out.filter((x): x is TextSection => x !== null);
}
