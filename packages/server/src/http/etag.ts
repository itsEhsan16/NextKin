import { errors } from './errors';

/**
 * Optimistic concurrency (ImBackendImplementationPlan P3-06). Web and mobile edit the same
 * profile and settings, so a write must name the version it was based on. The ETag is the row's
 * `row_version`; a write without If-Match gets 428, a stale one gets 412, and nothing is lost.
 */
export function etagFor(rowVersion: number): string {
  return `"v${rowVersion}"`;
}

/** Returns the version the client's If-Match names, or throws 428/412-style errors. */
export function requireIfMatch(header: string | undefined, currentVersion: number): void {
  if (!header) throw errors.preconditionRequired();
  const candidates = header.split(',').map((s) => s.trim().replace(/^W\//, ''));
  if (!candidates.includes('*') && !candidates.includes(etagFor(currentVersion))) throw errors.preconditionFailed();
}
