'use client';

import { useSearchParams } from 'next/navigation';

import { AtsCheckScreen } from './AtsCheckScreen';
import { CoverLetterScreen } from './CoverLetterScreen';
import { ZeroResumeScreen } from './ZeroResumeScreen';

/**
 * The Quick Start flows' query (toreview §125), read in the browser so the routes stay static and
 * prefetchable, as the other routes do. `run` is a started run; the rest prefill the setup.
 */
type Params = { get: (key: string) => string | null };
const read = (params: Params, key: string) => {
  const value = params.get(key);
  return value ? { [key]: value } : {};
};

const runOf = (params: Params) => {
  const run = params.get('run');
  return run ? { runId: run } : {};
};
export function ZeroResumeRoute() {
  const params = useSearchParams();
  return (
    <ZeroResumeScreen {...read(params, 'role')} {...read(params, 'jobId')} {...runOf(params)} />
  );
}

export function CoverLetterRoute() {
  const params = useSearchParams();
  const job = params.get('job');
  const jd = params.get('jd');
  const step = params.get('step');
  return (
    <CoverLetterScreen
      {...(job
        ? { target: { kind: 'job' as const, id: job } }
        : jd
          ? { target: { kind: 'jd' as const, id: jd } }
          : {})}
      {...read(params, 'resumeId')}
      {...(step === 'tone' || step === 'resume' ? { step } : {})}
      {...runOf(params)}
    />
  );
}

export function AtsCheckRoute() {
  const params = useSearchParams();
  return (
    <AtsCheckScreen
      {...read(params, 'resumeId')}
      {...(params.get('step') === 'job' ? { step: 'job' as const } : {})}
      {...runOf(params)}
    />
  );
}
