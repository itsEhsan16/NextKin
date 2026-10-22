'use client';

import { useSearchParams } from 'next/navigation';

import { ApplicationsScreen } from './ApplicationsScreen';

/**
 * `/applications?application=<id>` opens that application on arrival (`../applicationHref.ts`). Read in the browser, like
 * `JobsRoute`, so the route stays static and prefetched.
 */
export function ApplicationsRoute() {
  const id = useSearchParams().get('application');
  return <ApplicationsScreen initialId={id ?? undefined} />;
}
