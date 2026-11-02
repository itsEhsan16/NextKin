import type { Route } from 'next';

import { tailorPath } from '@/features/tailor/tailorTarget';

/**
 * The job-first flows of Home's Quick Start (toreview §126, owner 2026-10-20): every one starts the
 * way mobile's does — the job (a saved one, or one from anywhere), then the resume, then the
 * comparison and what to improve. One config, so the four tiles cannot drift apart.
 */
export type JobFlow = 'build' | 'tailor' | 'cover-letter' | 'ats-check';

/** What step 1 picked: a saved listing, or a job description read from text, a link or a file. */
export type PickedJob = { kind: 'job'; id: string } | { kind: 'jd'; id: string };

type FlowCopy = {
  name: string;
  /** The header's line over the step: "Tailor to a job" (849:163). */
  eyebrow: string;
  steps: readonly string[];
  jobTitle: string;
  jobLede: string;
};

export const JOB_FLOWS: Record<JobFlow, FlowCopy> = {
  build: {
    name: 'Build Resume',
    eyebrow: 'Build a resume',
    steps: ['Job', 'Resume', 'Enhance'],
    jobTitle: 'Which job is this resume for?',
    jobLede:
      'Pick one of your saved jobs, or bring one from anywhere. We’ll compare your profile with it next.',
  },
  tailor: {
    name: 'Tailor to a Job',
    eyebrow: 'Tailor to a job',
    steps: ['Job', 'Resume', 'Enhance'],
    jobTitle: 'Which job is this resume for?',
    jobLede:
      'Pick one of your saved jobs, or bring one from anywhere. We’ll compare your resume with it next.',
  },
  'cover-letter': {
    name: 'Cover Letter',
    eyebrow: 'Cover letter',
    steps: ['Job', 'Resume', 'Your letter'],
    jobTitle: 'Which job is the letter for?',
    jobLede:
      'Pick a saved job or bring one from anywhere. The letter is written from your resume for it.',
  },
  'ats-check': {
    name: 'ATS Check',
    eyebrow: 'ATS check',
    steps: ['Resume', 'Job', 'Your score'],
    jobTitle: 'Which job should we check it against?',
    jobLede:
      'A score only means something against a job. Pick a saved one, or bring one from anywhere.',
  },
};

export function jobFlowHref(flow: JobFlow): Route {
  return `/create/${flow}` as Route;
}

/**
 * Where step 1 hands over. Tailor and Build go on to the comparison and the choices on the tailor
 * screen (the resume step comes in next, toreview §126.3); Build opens it on building.
 */
export function afterJob(flow: 'build' | 'tailor', job: PickedJob): Route {
  return tailorPath({ kind: job.kind, id: job.id }, flow === 'build' ? { mode: 'build' } : {});
}
