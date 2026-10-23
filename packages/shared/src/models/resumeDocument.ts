/**
 * The resume editor's document (toreview §124): everything the printed page holds, in the shape the
 * editor edits. `resumeContent.ts` stays the lighter model the library, the tailor flow and mobile
 * read; this one adds what only a full editor needs — the header, skill groups, a role's client
 * projects, custom sections, the section order and headings, and the template — and gives every
 * line an id, so an unchanged line keeps the claim and evidence it was written with.
 *
 * Written back onto the canonical JSON by `scoring/resumeDocument.ts`. Dates are `YYYY` or
 * `YYYY-MM`; `null` start is "not given", `null` end is "present".
 */

export type ResumeTemplateId = 'jake' | 'modern' | 'elegant';

export type ResumeTemplateInfo = {
  id: ResumeTemplateId;
  name: string;
  description: string;
};

/** Every template is one column, real text and standard headings: each is ATS-safe by design. */
export const RESUME_TEMPLATES: readonly ResumeTemplateInfo[] = [
  { id: 'jake', name: 'Classic', description: 'Centred name, small-caps headings over a rule. The engineering standard.' },
  { id: 'modern', name: 'Modern', description: 'Clean sans-serif, name on the left, indigo headings.' },
  { id: 'elegant', name: 'Elegant', description: 'Book serif with generous spacing, for senior and non-technical roles.' },
];

export const DEFAULT_RESUME_TEMPLATE: ResumeTemplateId = 'jake';

export const isResumeTemplateId = (value: string): value is ResumeTemplateId =>
  RESUME_TEMPLATES.some((t) => t.id === value);

/** One printed line: a bullet, a custom section's line. */
export type DocLine = { id: string; text: string };

/** One piece of the contact row as printed: "Bengaluru, India", an email, a link's label. */
export type DocContactItem = { id: string; text: string; url?: string };

export type DocHeader = { name: string; headline: string; items: DocContactItem[] };

export type DocSkillGroup = { id: string; label: string; skills: string[] };

/** A client project inside a role: its own title, stack line and bullets. */
export type DocRoleGroup = { id: string; title: string; tech: string; bullets: DocLine[] };

export type DocRole = {
  id: string;
  company: string;
  title: string;
  location: string;
  start: string | null;
  end: string | null;
  /** The role's own bullets; `groups` are the client projects under it. */
  bullets: DocLine[];
  groups: DocRoleGroup[];
  /** Zero Resume guessed this role; the download waits for the review (V2 §7.9). */
  assumed?: boolean;
};

export type DocProject = {
  id: string;
  name: string;
  description: string;
  tech: string;
  start: string | null;
  end: string | null;
  bullets: DocLine[];
};

export type DocEducation = {
  id: string;
  institution: string;
  degree: string;
  field: string;
  start: string | null;
  end: string | null;
  gpa: string;
  location: string;
  assumed?: boolean;
};

export type DocCertification = { id: string; name: string; issuer: string };

export type DocCustomEntry = {
  id: string;
  title: string;
  subtitle: string;
  /** Flush right on the title row: usually a date. */
  right: string;
  subRight: string;
  bullets: DocLine[];
};

/** A section the six standard ones do not cover: Achievements, Awards, Volunteering, Languages. */
export type DocCustomSection = { id: string; heading: string; entries: DocCustomEntry[]; lines: DocLine[] };

export type StandardSectionKey = 'summary' | 'skills' | 'experience' | 'projects' | 'education' | 'certifications';

/** A standard section's key, or `x:<id>` for a custom one. */
export type DocSectionKey = StandardSectionKey | `x:${string}`;

export const STANDARD_SECTION_KEYS: readonly StandardSectionKey[] = ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'];

export const DEFAULT_SECTION_HEADING: Record<StandardSectionKey, string> = {
  summary: 'Summary',
  skills: 'Skills',
  experience: 'Experience',
  projects: 'Projects',
  education: 'Education',
  certifications: 'Certifications',
};

export type ResumeDocument = {
  resumeId: string;
  versionId: string;
  /** The body's revision: a save names the one it was made from, and a newer one refuses it. */
  revision: string;
  header: DocHeader;
  summary: string;
  skills: { groups: DocSkillGroup[]; loose: string[] };
  experience: DocRole[];
  projects: DocProject[];
  education: DocEducation[];
  certifications: DocCertification[];
  custom: DocCustomSection[];
  /** Every section, in print order. */
  order: DocSectionKey[];
  /** A heading the user renamed ("Technical Skills"); otherwise the default prints. */
  headings: Partial<Record<StandardSectionKey, string>>;
  template: ResumeTemplateId;
  /** Zero Resume left guesses to check: the download waits for that review (V2 §7.9). */
  pendingReview?: boolean;
};

/** What the editor's save sends: the document without the ids the server owns. */
export type ResumeDocumentWrite = Omit<ResumeDocument, 'resumeId' | 'versionId' | 'revision' | 'pendingReview'>;

/** Section starters the "Add section" menu offers; the user can name their own. */
export const CUSTOM_SECTION_PRESETS: readonly string[] = ['Achievements', 'Awards', 'Volunteering', 'Languages', 'Publications', 'Interests'];

export const sectionHeading = (doc: Pick<ResumeDocument, 'headings' | 'custom'>, key: DocSectionKey): string => {
  if (key.startsWith('x:')) return doc.custom.find((s) => `x:${s.id}` === key)?.heading.trim() || 'Untitled section';
  return doc.headings[key as StandardSectionKey]?.trim() || DEFAULT_SECTION_HEADING[key as StandardSectionKey];
};
