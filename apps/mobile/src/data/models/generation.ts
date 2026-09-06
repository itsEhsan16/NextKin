/**
 * NextKin V2 spec §10 — Generation pipeline.
 *
 * One pipeline runs every AI job in the product: the tailored resume (§7.6), the cover letter
 * (§7.10), a Zero Resume Mode first draft (§7.9), a standalone ATS check (§7.8) and an interview
 * question set (§7.15). `kind` is what the progress copy and the result screen read to tell the
 * runs apart. None of these flows has an artboard (plan phase 9), so the copy comes from the spec.
 */

import type { CoverLetterTone } from './resumeContent';

export type GenerationStatus =
  'queued' | 'generating' | 'validating' | 'scoring' | 'ready' | 'failed';

/** What a run produces. Every generated document and analysis goes through the one pipeline. */
export type GenerationKind = 'resume' | 'cover_letter' | 'zero_resume' | 'ats_check' | 'interview';

/** Names the run wherever it is listed — progress cards, history rows, result headers. */
export const GENERATION_KIND_LABEL: Record<GenerationKind, string> = {
  resume: 'Resume',
  cover_letter: 'Cover letter',
  zero_resume: 'Zero Resume Mode',
  ats_check: 'ATS check',
  interview: 'Interview questions',
};

export type Generation = {
  id: string;
  kind: GenerationKind;
  resumeId?: string;
  /** The JD draft this run was tailored to (V2 §7.5 → §7.6). */
  jdId?: string;
  jobId?: string;
  /** Cover letters only — the tone the draft was written in (V2 §7.10). */
  tone?: CoverLetterTone;
  /**
   * What the run is for, when nothing else on it says: a standalone interview set (§7.15) has no
   * resume and no JD, so this is the only place the role title can travel to completion.
   */
  title?: string;
  status: GenerationStatus;
  /** 0–1 */
  progress: number;
  /** ISO-8601 */
  startedAt: string;
  /** ISO-8601 */
  updatedAt: string;
  error?: string;
};

/** Everything a caller can hand the pipeline to start a run; the repo fills in the rest. */
export type GenerationInput = {
  kind: GenerationKind;
  jdId?: string;
  jobId?: string;
  /** The resume a tailored run starts from. */
  baseResumeId?: string;
  /** The document an ATS check or an interview set is about. */
  sourceResumeId?: string;
  /** Title for the document the run creates; the repo names it after the role when absent. */
  title?: string;
  tone?: CoverLetterTone;
  /** Zero Resume Mode's seed (V2 §7.9) — there is no resume to start from. */
  zero?: {
    fullName: string;
    yearsExperience: number;
    targetTitle?: string;
    location?: string;
  };
};

export type GenerationStep = {
  status: Exclude<GenerationStatus, 'failed'>;
  label: string;
  /** Short copy shown under the progress meter while the step is active. */
  hint: string;
};

/** Ordered pipeline steps; `failed` is a terminal branch, not a step. */
export const GENERATION_STEPS: readonly GenerationStep[] = [
  { status: 'queued', label: 'Queued', hint: 'Waiting for a free slot' },
  { status: 'generating', label: 'Generating', hint: 'Tailoring your resume to the role' },
  { status: 'validating', label: 'Validating', hint: 'Checking structure and facts' },
  { status: 'scoring', label: 'Scoring', hint: 'Running ATS keyword analysis' },
  { status: 'ready', label: 'Ready', hint: 'Your resume is ready to review' },
] as const;

/**
 * Per-kind overrides for the step copy. GENERATION_STEPS is written for a tailored resume
 * ("Tailoring your resume to the role"), which is wrong for a cover letter. A kind listed here
 * replaces the hints for the steps it names and inherits the rest.
 */
export const GENERATION_HINTS: Partial<
  Record<GenerationKind, Partial<Record<GenerationStep['status'], string>>>
> = {
  cover_letter: {
    generating: 'Writing your cover letter',
    ready: 'Your cover letter is ready to review',
  },
  ats_check: { generating: 'Reading your resume', ready: 'Your ATS score is ready' },
  zero_resume: { generating: 'Drafting from your profile' },
  interview: { generating: 'Writing your questions', ready: 'Your practice set is ready' },
};

export const TERMINAL_GENERATION_STATUSES: readonly GenerationStatus[] = ['ready', 'failed'];

export function isGenerationTerminal(status: GenerationStatus): boolean {
  return TERMINAL_GENERATION_STATUSES.includes(status);
}

/** Index of a status within GENERATION_STEPS (failed → -1). */
export function generationStepIndex(status: GenerationStatus): number {
  return GENERATION_STEPS.findIndex((step) => step.status === status);
}

/** The line under the progress meter: this kind's override, else the step's own hint. */
export function generationHint(generation: Generation): string {
  const index = generationStepIndex(generation.status);
  // `failed` is not a step, so the index is -1 and the lookup is undefined — there is no hint,
  // and the caller shows the error instead.
  const step: GenerationStep | undefined = GENERATION_STEPS[index];
  if (!step) return '';
  return GENERATION_HINTS[generation.kind]?.[step.status] ?? step.hint;
}
