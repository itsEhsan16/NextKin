import type { JdReading } from '../jobs/jdSections';
import type { JdStructured } from './jdStructured';
import type { EmploymentType, ExperienceLevel, Job } from './job';

/**
 * How the profile matches a job description, as its own page's match card shows it: the listing
 * match's fields, from the same engine (P11-03). Null where there is nothing to score.
 */
export type JdMatch = Pick<Job, 'matchScore' | 'matchBand' | 'matchBasis' | 'matchCriteria' | 'matchReason'>;

/**
 * NextKin V2 spec §7.5 — JD upload, extraction and the review screen. No artboard exists for
 * this flow (plan §8, phase 9), so the shape follows the spec's field list.
 */

/**
 * A picked file. Structurally the same as @/lib's PickedDocument, redeclared here so the
 * data layer never imports the lib barrel.
 */
export type JdFile = { name: string; uri: string; mimeType?: string; size?: number };

/**
 * The input paths: pasted text, an uploaded PDF/DOCX/TXT, a job-board listing, or a link to a
 * posting. V2 §7.5 names only the first three; the web upload board (244:467) adds the link.
 */
export type JdSource = 'paste' | 'file' | 'job' | 'link';

/** Caption above the extraction, so the review screen can say what it read. */
export const JD_SOURCE_LABEL: Record<JdSource, string> = {
  paste: 'Pasted text',
  file: 'Uploaded file',
  job: 'From a job listing',
  link: 'From a link',
};

/** What the user hands in before extraction runs. */
export type JdInput = (
  | { source: 'paste'; text: string }
  | { source: 'file'; file: JdFile }
  | { source: 'job'; jobId: string }
  | { source: 'link'; url: string }
) & {
  /**
   * What the user typed in beside the source, which beats what the extraction reads: the web
   * upload board's "Additional details" (247:599). A blank field means "use what was read".
   */
  details?: JdDraftPatch;
};

/**
 * The extraction. Every field is editable until the user confirms it, and what they confirm is
 * what generation, scoring and cover letters consume (V2 §7.5).
 */
/** The title a JD gets when its text names none (G13: never a guess); its page asks for it. */
export const UNTITLED_JD = 'Untitled job description';

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
  /** Traits the JD asks for ("communication"): shown, never scored (toreview §112). */
  softSkills?: string[];
  /** Domain/industry the JD sits in (V2 §7.5). */
  domain?: string;
  /** The original text stays visible beside the extraction (V2 7.5). */
  rawText: string;
  /** Set when the JD came from a listing, so the saved JD and the job stay linked. */
  jobId?: string;
  /** The posting a link-sourced JD was read from. */
  sourceUrl?: string;
  /** Full-time, contract…: the web upload board's "Employment type". V2 §7.5 doesn't list it. */
  employmentType?: EmploymentType;
  /** The web upload board's "Save this job to my jobs" (247:631). No list reads it yet. */
  savedToJobs?: boolean;
  /**
   * The skill lists and the text read as typed requirements, with where the JD says each (C-10).
   * Derived: recomputed whenever the lists change, so it never disagrees with what the user confirmed.
   */
  requirements?: JdRequirement[];
  /**
   * The server's extraction is a job the repository awaits (P9-01): `extracting` until it lands.
   * Absent on the mock, whose extraction is immediate.
   */
  status?: 'extracting' | 'ready' | 'failed';
  /** Plain language, when the extraction failed. */
  error?: string;
  /** Which failure it was, when the extraction failed (toreview §206). */
  failureReason?: JdFailureReason;
  /** What the extraction kept, and how many items it dropped for want of a quote in the text. */
  extraction?: { kept: number; dropped: number };
  /** The language the JD is written in (D-11: German JDs are read, resumes stay English). */
  language?: 'en' | 'de' | 'other';
  /**
   * The JD in its sections, when the server had a model group them because the text has too few
   * headings to read by rule (toreview §129). Every line is the JD's own. Absent otherwise: the page
   * reads the sections from `rawText` itself (`jobs/jdSections.ts`).
   */
  reading?: JdReading;
  /**
   * The posting understood (toreview §153): every fact in its place with the words it came from,
   * issues flagged. Absent on drafts read before it, which the server reads again once.
   */
  structured?: JdStructured;
  /** Where the reading is while `extracting`, so the page shows the real step. */
  stage?: JdStage;
  /** ISO-8601 */
  createdAt: string;
};

export type JdStage = 'reading' | 'understanding' | 'checking';

/**
 * Why a job description could not be read (toreview §206), so a screen can say the right thing
 * and offer the right next step. `error` carries the server's sentence; this names the case.
 */
export const JD_FAILURE_REASONS = [
  'invalid',
  'private',
  'robots',
  'refused',
  'gone',
  'unsupported',
  'too_large',
  'timeout',
  'unreachable',
  'empty',
  /** A list of jobs or a search page, not one posting. */
  'listing',
  /** The posting was taken down or has closed, and its description is no longer there. */
  'removed',
  /** Text that is not a job posting at all. */
  'not_a_job',
  'unreadable',
  'provider',
] as const;
export type JdFailureReason = (typeof JD_FAILURE_REASONS)[number];

/**
 * A posting that was read but says it has closed, or whose closing date has passed (toreview
 * §206). Its description is still usable; every screen that goes on with it says so first.
 */
export const jdHasClosed = (draft: Pick<JdDraft, 'structured'> | undefined): boolean =>
  Boolean(draft?.structured?.issues.some((issue) => issue.kind === 'expired'));

export const JD_CLOSED_TITLE = 'This posting has closed';
export const JD_CLOSED_NOTE =
  'It may no longer take applications. You can still build a resume for it.';

/** One typed requirement (C-10; the extractor verifies spans from P9). */
export type JdRequirement = {
  id: string;
  text: string;
  importance: 'required' | 'preferred';
  /** Eligibility (work authorization, language, location, clearance) is flagged and never scored. */
  kind: 'skill' | 'eligibility';
  minYears?: number;
  /** Offsets into `rawText`, when the JD states it. */
  span?: { start: number; end: number };
};

/** Every edit the review screen can make; identity, origin and the source text are fixed. */
export type JdDraftPatch = Partial<
  Omit<JdDraft, 'id' | 'createdAt' | 'source' | 'rawText' | 'sourceUrl' | 'requirements' | 'status' | 'error' | 'failureReason' | 'extraction' | 'language' | 'reading' | 'structured' | 'stage'>
>;
