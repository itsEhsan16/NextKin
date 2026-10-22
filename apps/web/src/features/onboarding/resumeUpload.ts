import type { ProfileDraft } from '@nextkin/shared/models';

/** ONB 04b reads "PDF or DOCX" (814:379). The board's earlier "Max 5MB" was dropped (§106.1). */
const RESUME_EXTENSIONS = ['pdf', 'docx'];
export const RESUME_ACCEPT = RESUME_EXTENSIONS.map((ext) => `.${ext}`).join(',');
/** The file picker's filter for a resume: the extensions and their types (toreview §131). */
export const RESUME_INPUT_ACCEPT = `${RESUME_ACCEPT},application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document`;

/** Why a picked file can't be read, or `null` when it can. */
export function resumeFileProblem(file: { name: string; size: number }): string | null {
  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : '';
  if (!RESUME_EXTENSIONS.includes(ext)) return 'Upload your resume as a PDF or DOCX file.';
  if (file.size === 0) return 'That file is empty. Choose another one.';
  return null;
}

export const isPdfName = (name: string) => /\.pdf$/i.test(name);

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * "Read · 4 roles and 12 skills found" (814:387), counted from what the parse actually found.
 * The draft is not applied here: §7.4 commits nothing until the user accepts it on the review.
 */
export function readSummary(draft: ProfileDraft): string {
  const roles = draft.experiences?.length ?? 0;
  const skills = draft.skills?.length ?? 0;
  if (roles === 0 && skills === 0) return 'Read · no roles or skills found';
  return `Read · ${count(roles, 'role', 'roles')} and ${count(skills, 'skill', 'skills')} found`;
}
