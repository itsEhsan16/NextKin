/**
 * The marketing site on its own host (owner, 2026-11-20): nextkin.ai shows the landing page
 * (Figma 524:419) as its first page, app.nextkin.ai keeps the user app.
 *
 * `LANDING_HOST` (comma-separated, e.g. `nextkin.ai,www.nextkin.ai`) and `APP_HOST`
 * (`app.nextkin.ai`) are server-only runtime configuration, read per request like `ADMIN_HOST`.
 * Unset, nothing changes: the page stays reachable at /landing on any host.
 */

export const LANDING_PATH = '/landing';

/** Pages the marketing host serves itself, besides the landing page. */
const SHARED_PUBLIC = ['/legal', '/account-deletion'];

const isShared = (pathname: string) =>
  SHARED_PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function parseHosts(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export type LandingRoute =
  { kind: 'rewrite'; pathname: string } | { kind: 'redirect'; location: string } | null;

/**
 * What the proxy does with a page request on a landing host, or null to serve it as asked.
 * - `/` is rewritten to the landing page, so the address bar keeps `nextkin.ai/`.
 * - Legal pages and the landing page itself are served as they are.
 * - Anything else belongs to the app: it moves to the same path on the app host (when known).
 */
export function landingHostRoute({
  host,
  pathname,
  search,
  landingHosts,
  appHost,
}: {
  host: string;
  pathname: string;
  search: string;
  landingHosts: string[];
  appHost: string | undefined;
}): LandingRoute {
  if (!landingHosts.includes(host)) return null;
  if (pathname === '/') return { kind: 'rewrite', pathname: LANDING_PATH };
  if (pathname === LANDING_PATH || isShared(pathname)) return null;
  if (!appHost) return null;
  return { kind: 'redirect', location: `https://${appHost}${pathname}${search}` };
}
