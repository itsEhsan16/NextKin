import { createHash } from 'node:crypto';

/**
 * A listing's identity (ImBackendImplementationPlan P11-01, P11-02). The dedupe key is the hash of
 * its canonical apply URL; the id the apps carry everywhere (search, picks, saved, deep links) is
 * derived from that hash, so one listing keeps one id across cache purges and across providers that
 * list the same job. `app.job_id_of(hash)` (migration 0019) computes the same id in SQL.
 */

const TRACKING = /^(utm_[a-z]+|gclid|fbclid|ref|source|src)$/i;

/** Lower-case scheme and host, no fragment, no tracking parameters, sorted query, no trailing slash. */
export function canonicalApplyUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = '';
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  const kept = [...url.searchParams.entries()].filter(([key]) => !TRACKING.test(key)).sort(([a], [b]) => a.localeCompare(b));
  url.search = new URLSearchParams(kept).toString();
  const text = url.toString();
  return text.endsWith('/') && url.pathname !== '/' ? text.slice(0, -1) : text.replace(/\/$/, '');
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

export const applyUrlHashOf = (applyUrl: string): string => sha256(canonicalApplyUrl(applyUrl));

/** The local catalogue's listings hash by their fixture id, as the seeded saves do. */
export const fixtureHashOf = (fixtureId: string): string => sha256(`fixture:${fixtureId}`);

/** A version-8 UUID from the apply-URL hash: md5 of the hash, with the version and variant bits set. */
export function jobIdOf(applyUrlHash: string): string {
  const h = createHash('md5').update(applyUrlHash).digest('hex');
  const variant = '89ab'[parseInt(h[16]!, 16) % 4]!;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
