/**
 * The admin portal on its own host (owner, 2026-11-20, toreview §249): admin.app.nextkin.ai serves
 * the portal, app.nextkin.ai serves the user app, and neither serves the other's pages.
 *
 * `ADMIN_HOST` is server-only runtime configuration (the proxy reads it per request, like the
 * storage origin). Unset, nothing changes: local development and the cloudfront.net address keep
 * serving the portal at /admin.
 */

const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/');

/** The visitor's host, without a port: what CloudFront forwarded, or the Host header. */
export function requestHost(headers: Headers): string {
  const raw = headers.get('x-forwarded-host') ?? headers.get('host') ?? '';
  return raw.split(',')[0]!.trim().toLowerCase().replace(/:\d+$/, '');
}

/**
 * Where a page request must go instead, or null to serve it as asked.
 * - On the admin host, anything outside /admin goes to /admin (the portal's home).
 * - Elsewhere, /admin and /admin/* move to the same path on the admin host, so old links and
 *   bookmarks keep working and a staff session only ever lives on the admin host's cookie.
 */
export function adminHostRedirect({
  host,
  pathname,
  search,
  adminHost,
}: {
  host: string;
  pathname: string;
  search: string;
  adminHost: string | undefined;
}): string | null {
  if (!adminHost) return null;
  if (host === adminHost) return isAdminPath(pathname) ? null : '/admin';
  return isAdminPath(pathname) ? `https://${adminHost}${pathname}${search}` : null;
}
