/** NextKin V2 spec §10 — Generation pipeline (resume/cover-letter creation). */

export type GenerationStatus =
  'queued' | 'generating' | 'validating' | 'scoring' | 'ready' | 'failed';

export type Generation = {
  id: string;
  resumeId?: string;
  jobId?: string;
  status: GenerationStatus;
  /** 0–1 */
  progress: number;
  /** ISO-8601 */
  startedAt: string;
  /** ISO-8601 */
  updatedAt: string;
  error?: string;
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

export const TERMINAL_GENERATION_STATUSES: readonly GenerationStatus[] = ['ready', 'failed'];

export function isGenerationTerminal(status: GenerationStatus): boolean {
  return TERMINAL_GENERATION_STATUSES.includes(status);
}

/** Index of a status within GENERATION_STEPS (failed → -1). */
export function generationStepIndex(status: GenerationStatus): number {
  return GENERATION_STEPS.findIndex((step) => step.status === status);
}
