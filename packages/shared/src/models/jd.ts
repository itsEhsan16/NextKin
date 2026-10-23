import type { ExperienceLevel } from './job';

/**
 * NextKin V2 spec §7.5 — JD upload, extraction and the review screen. No artboard exists for
 * this flow (plan §8, phase 9), so the shape follows the spec's field list.
 */

/**
 * A picked file. Structurally the same as @/lib's PickedDocument, redeclared here so the
 * data layer never imports the lib barrel.
 */
export type JdFile = { name: string; uri: string; mimeType?: string; size?: number };

/** The three input paths: pasted text, an uploaded PDF/DOCX/TXT, or a job-board listing. */
export type JdSource = 'paste' | 'file' | 'job';

/** Caption above the extraction, so the review screen can say what it read. */
export const JD_SOURCE_LABEL: Record<JdSource, string> = {
  paste: 'Pasted text',
  file: 'Uploaded file',
  job: 'From a job listing',
};

/** What the user hands in before extraction runs. */
export type JdInput =
  | { source: 'paste'; text: string }
  | { source: 'file'; file: JdFile }
  | { source: 'job'; jobId: string };

/**
 * The extraction. Every field is editable until the user confirms it, and what they confirm is
 * what generation, scoring and cover letters consume (V2 §7.5).
 */
export type JdDraft = {
  id: string;
  source: JdSource;
  title: string;
  company?: string;
  location?: string;
  experienceLevel?: ExperienceLevel;
  /** Split per V2 7.5: the review screen moves a skill between these two groups. */
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  tools: string[];
  /** Domain/industry the JD sits in (V2 §7.5). */
  domain?: string;
  /** The original text stays visible beside the extraction (V2 7.5). */
  rawText: string;
  /** Set when the JD came from a listing, so the saved JD and the job stay linked. */
  jobId?: string;
  /** ISO-8601 */
  createdAt: string;
};

/** Every edit the review screen can make; identity, origin and the source text are fixed. */
export type JdDraftPatch = Partial<Omit<JdDraft, 'id' | 'createdAt' | 'source' | 'rawText'>>;
