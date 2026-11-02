'use client';

import { useSearchParams } from 'next/navigation';

import { parseTailorStep, type TailorTargetRef } from '../tailorTarget';
import { TailorScreen } from './TailorScreen';

/**
 * `?resumeId=` is the resume being tailored; `?run=<generation>` opens a started run on its
 * progress or result. Read in the browser, like the other routes, so the page stays prefetchable.
 * The screen is not remounted when the run comes or goes, so a failed run's "Back" keeps the
 * user's choices (toreview §114).
 */
export function TailorRoute({ target }: { target: TailorTargetRef }) {
  const params = useSearchParams();
  const run = params.get('run');
  const resumeId = params.get('resumeId');
  // `?mode=build` is Home's Build Resume: a new resume for this job, from the profile (§125).
  const build = params.get('mode') === 'build';
  // `?step=` is which W-FLOW step after the job (toreview §126).
  const step = params.get('step');
  return (
    <TailorScreen
      target={target}
      {...(resumeId ? { resumeId } : {})}
      {...(run ? { runId: run } : {})}
      {...(build ? { build } : {})}
      {...(parseTailorStep(step) ? { step: parseTailorStep(step) } : {})}
    />
  );
}
