import type {
  DocumentContent,
  EditableSectionKey,
  ResumeContent,
  ResumeSectionKey,
} from '@/data/models';

/**
 * NextKin V2 spec §7.11 / §7.10 — what the section editor holds while it is being edited, and
 * what leaves it on Save. Split from `sectionEdits` so that file is the rules and this one is the
 * shape; nothing here imports from it, so the two never form a cycle.
 */

/** The three fields §7.10 lets a reader edit by hand. */
export type LetterDraft = { greeting: string; paragraphs: string[]; signoff: string };

/**
 * One resume section and its value, correlated. Structurally the `ResumeSectionEdit` the mutation
 * takes, so a narrowed draft is handed straight to `useUpdateResumeSection`.
 */
export type ResumeSectionDraft = {
  [K in ResumeSectionKey]: { section: K; value: ResumeContent[K] };
}[ResumeSectionKey];

/** Everything the editor can hold: §7.11's six sections, or §7.10's letter body. */
export type SectionDraft = ResumeSectionDraft | { section: 'letter'; value: LetterDraft };

/**
 * Seeds a draft from the loaded body, or says the section is not part of this document — a
 * resume has no letter and a cover letter has none of §7.11's six sections, and the route param
 * can name either against either.
 */
export function draftFor(
  content: DocumentContent,
  section: EditableSectionKey,
): SectionDraft | undefined {
  if (section === 'letter') {
    if (content.kind !== 'cover_letter') return undefined;
    const { greeting, paragraphs, signoff } = content;
    return { section, value: { greeting, paragraphs: [...paragraphs], signoff } };
  }
  if (content.kind !== 'resume') return undefined;
  switch (section) {
    case 'summary':
      return { section, value: content.summary };
    case 'skills':
      return { section, value: [...content.skills] };
    case 'certifications':
      return { section, value: [...content.certifications] };
    case 'experience':
      return { section, value: content.experience.map((r) => ({ ...r, bullets: [...r.bullets] })) };
    case 'projects':
      return { section, value: content.projects.map((p) => ({ ...p, bullets: [...p.bullets] })) };
    case 'education':
      return { section, value: content.education.map((entry) => ({ ...entry })) };
  }
}

/**
 * Whether the draft still says what loaded. Both sides are built by `draftFor` and mutated only
 * through the helpers in `sectionEdits`, so key order is stable and a serialised compare is
 * honest — and it is the only comparison that reaches into a role's bullets without a
 * hand-written walk per shape.
 */
export const draftsEqual = (a: SectionDraft, b: SectionDraft): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** Trims the draft on the way out, so trailing whitespace never reaches the document. */
export function normalizeSection(draft: ResumeSectionDraft): ResumeSectionDraft {
  switch (draft.section) {
    case 'summary':
      return { section: 'summary', value: draft.value.trim() };
    case 'skills':
      return { section: 'skills', value: draft.value.map((entry) => entry.trim()) };
    case 'certifications':
      return { section: 'certifications', value: draft.value.map((entry) => entry.trim()) };
    case 'experience':
      return {
        section: 'experience',
        value: draft.value.map((role) => ({
          ...role,
          company: role.company.trim(),
          title: role.title.trim(),
          period: role.period.trim(),
          bullets: role.bullets.map((b) => b.trim()).filter((b) => b.length > 0),
        })),
      };
    case 'projects':
      return {
        section: 'projects',
        value: draft.value.map((project) => ({
          ...project,
          name: project.name.trim(),
          description: project.description.trim(),
          bullets: project.bullets.map((b) => b.trim()).filter((b) => b.length > 0),
        })),
      };
    case 'education':
      return {
        section: 'education',
        value: draft.value.map((entry) => ({
          ...entry,
          institution: entry.institution.trim(),
          degree: entry.degree.trim(),
          period: entry.period.trim(),
        })),
      };
  }
}

/** §7.10's patch: blank paragraphs are dropped rather than printed as empty lines. */
export const letterPatch = (draft: LetterDraft): LetterDraft => ({
  greeting: draft.greeting.trim(),
  paragraphs: draft.paragraphs.map((p) => p.trim()).filter((p) => p.length > 0),
  signoff: draft.signoff.trim(),
});
