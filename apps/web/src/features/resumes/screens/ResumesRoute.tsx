'use client';

import { useSearchParams } from 'next/navigation';

import { ResumesScreen } from './ResumesScreen';

/**
 * `/resumes?resume=<id>` opens that resume on arrival (`../resumeHref.ts`). Read in the browser, like
 * `JobsRoute`, so the route stays static and prefetched.
 */
export function ResumesRoute() {
  const id = useSearchParams().get('resume');
  return <ResumesScreen initialId={id ?? undefined} />;
}
