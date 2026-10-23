import type { Route } from 'next';

/**
 * The Jobs page with one job open: `app/(app)/jobs/page.tsx` reads `?job=` and hands it to
 * `JobsScreen`. How an application's "View Job" (Figma 332:462) gets back to its listing.
 */
export function jobHref(id: string): Route {
  return `/jobs?job=${encodeURIComponent(id)}` as Route;
}
