/**
 * Which browser origins count as the app's own for CSRF and login CSRF (P3-03). Always the
 * configured APP_ORIGIN; locally, also each of APP_EXTRA_ORIGINS (toreview §131.10), so the same
 * server answers http://localhost:3000 and a Cloudflare tunnel at once. A pattern may carry one
 * `*` for a single DNS label (`https://*.trycloudflare.com`); config refuses the list outside
 * local, test and dev.
 */
export type OriginCheck = (origin: string) => boolean;

const escape = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

export function trustedOrigins(appOrigin: string, extra: readonly string[] = []): OriginCheck {
  const exact = new Set([appOrigin, ...extra.filter((o) => !o.includes('*'))]);
  const patterns = extra.filter((o) => o.includes('*')).map((o) => new RegExp(`^${o.split('*').map(escape).join('[a-z0-9-]+')}$`, 'i'));
  return (origin) => exact.has(origin) || patterns.some((p) => p.test(origin));
}
