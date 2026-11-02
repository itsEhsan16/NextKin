import type { Route } from 'next';

import { applicationHref } from '@/features/applications/applicationHref';

/**
 * Where a notification goes on the web. The feed's links are the phone's routes, filed by the server
 * once for both apps, so each is mapped here; one with no web page gets no link, never a 404.
 */
export function webHrefOf(deepLink: string | undefined): Route | null {
  if (!deepLink) return null;
  const application = /^\/applications\/([^/?#]+)$/.exec(deepLink);
  if (application?.[1]) return applicationHref(decodeURIComponent(application[1]));
  // A run's own page is the phone's; on the web a finished run is found in the library.
  if (/^\/generations\/[^/?#]+$/.test(deepLink)) return '/resumes' as Route;
  if (/^\/jobs(\/[^/?#]+)?$/.test(deepLink)) return deepLink as Route;
  if (deepLink === '/upgrade' || deepLink === '/notifications') return deepLink as Route;
  return null;
}
