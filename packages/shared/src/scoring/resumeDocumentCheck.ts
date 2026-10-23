import type { DocSectionKey, ResumeDocument } from '../models/resumeDocument';
import type { CanonicalResumeJson } from '../schemas/resumeContent';
import { documentOf, type DocumentOwner } from './resumeDocument';

/**
 * What stops a resume from being downloaded yet (toreview §124): a page with no name, nothing in
 * it, or an entry missing what it is (a role with no employer). Each problem names the section and
 * the entry, so the editor can take the user straight to it. Pure; the server runs the same check
 * before an export, so the button and the API refuse the same things.
 */

export type DocProblem = { section: DocSectionKey | 'header'; entryId?: string; message: string };

export function documentProblems(doc: Pick<ResumeDocument, 'header' | 'summary' | 'skills' | 'experience' | 'projects' | 'education' | 'certifications' | 'custom'>): DocProblem[] {
  const problems: DocProblem[] = [];
  if (!doc.header.name.trim()) problems.push({ section: 'header', message: 'Add your name at the top.' });

  const hasContent =
    doc.summary.trim() !== '' ||
    doc.skills.loose.length > 0 ||
    doc.skills.groups.some((g) => g.skills.length > 0) ||
    doc.experience.length > 0 ||
    doc.projects.length > 0 ||
    doc.education.length > 0 ||
    doc.certifications.some((c) => c.name.trim()) ||
    doc.custom.some((s) => s.entries.length > 0 || s.lines.some((l) => l.text.trim()));
  if (!hasContent) problems.push({ section: 'summary', message: 'Add at least one section: a summary, your experience or your education.' });

  for (const role of doc.experience) {
    const what = role.title.trim() || role.company.trim() || 'A role';
    if (!role.company.trim()) problems.push({ section: 'experience', entryId: role.id, message: `${what}: add the employer.` });
    if (!role.title.trim()) problems.push({ section: 'experience', entryId: role.id, message: `${what}: add your job title.` });
    if (role.start !== null && role.end !== null && role.end < role.start) problems.push({ section: 'experience', entryId: role.id, message: `${what}: the end date is before the start.` });
  }
  for (const project of doc.projects) {
    if (!project.name.trim()) problems.push({ section: 'projects', entryId: project.id, message: 'A project needs a name.' });
  }
  for (const school of doc.education) {
    if (!school.institution.trim()) problems.push({ section: 'education', entryId: school.id, message: `${school.degree.trim() || 'An education entry'}: add the school.` });
    if (!school.degree.trim()) problems.push({ section: 'education', entryId: school.id, message: `${school.institution.trim() || 'An education entry'}: add the degree or course.` });
  }
  for (const section of doc.custom) {
    if (!section.heading.trim()) problems.push({ section: `x:${section.id}`, message: 'A custom section needs a heading.' });
    for (const entry of section.entries) if (!entry.title.trim()) problems.push({ section: `x:${section.id}`, entryId: entry.id, message: `${section.heading.trim() || 'A section'}: an entry needs a title.` });
  }
  return problems;
}

/** The export gate's sentence for a stored resume, or null when it can go out. */
export function exportProblem(doc: CanonicalResumeJson, owner: DocumentOwner): string | null {
  const problems = documentProblems(documentOf(doc, { resumeId: '', versionId: '', revision: '' }, owner));
  if (problems.length === 0) return null;
  const more = problems.length > 1 ? ` (and ${problems.length - 1} more)` : '';
  return `Before you download: ${problems[0]!.message}${more}`;
}
