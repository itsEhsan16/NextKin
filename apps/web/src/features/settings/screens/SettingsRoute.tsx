'use client';

import { useSearchParams } from 'next/navigation';

import { isSettingsSection } from '../settingsLibrary';
import { SettingsScreen } from './SettingsScreen';

/**
 * `/settings?tab=<section>` opens that section on arrival.
 *
 * Read here, in the browser, rather than by the page on the server: a page that awaits
 * `searchParams` is rendered per request, so every click into it waited on the server. Read on
 * the client, the route is static and Next prefetches all of it (`toreview.md` §84).
 */
export function SettingsRoute() {
  const tab = useSearchParams().get('tab');
  return (
    <SettingsScreen initialSection={tab !== null && isSettingsSection(tab) ? tab : undefined} />
  );
}
