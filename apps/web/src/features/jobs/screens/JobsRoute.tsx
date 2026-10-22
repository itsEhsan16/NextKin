'use client';

import { useSearchParams } from 'next/navigation';

import { JobsScreen } from './JobsScreen';

/**
 * `/jobs?job=<id>` opens that job on arrival (`src/features/jobs/jobHref.ts`).
 *
 * The parameter is read here, in the browser, rather than by the page on the server: a page that
 * awaits `searchParams` is rendered per request, so every click into it waited on the server.
 * Read on the client, the route is static and Next prefetches all of it (`toreview.md` §84).
 */
export function JobsRoute() {
  const job = useSearchParams().get('job');
  return <JobsScreen initialJobId={job ?? undefined} />;
}
