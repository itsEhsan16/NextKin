'use client';

import { useSearchParams } from 'next/navigation';

import { isProfileTab } from '../profileLibrary';
import { ProfileScreen } from './ProfileScreen';

/**
 * `/profile?tab=<section>` opens that section on arrival.
 *
 * Read here, in the browser, rather than by the page on the server: a page that awaits
 * `searchParams` is rendered per request, so every click into it waited on the server. Read on
 * the client, the route is static and Next prefetches all of it (`toreview.md` §84).
 */
export function ProfileRoute() {
  const tab = useSearchParams().get('tab');
  return <ProfileScreen initialTab={tab !== null && isProfileTab(tab) ? tab : undefined} />;
}
