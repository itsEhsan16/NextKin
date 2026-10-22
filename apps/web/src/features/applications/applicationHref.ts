import type { Route } from 'next';

/**
 * The Applications page with one application open: `ApplicationsRoute` reads `?application=` and hands it to
 * `ApplicationsScreen`, the same way `jobHref` opens a job (`toreview.md` §102).
 */
export function applicationHref(id: string): Route {
  return `/applications?application=${encodeURIComponent(id)}` as Route;
}
