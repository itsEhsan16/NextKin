import { createHash } from 'node:crypto';

/**
 * Deterministic UUIDs for seeded rows (RFC 4122 version 5 shape, SHA-1 over a fixed namespace).
 * The same fixture id always maps to the same database id, so re-running the seed replaces rows
 * instead of duplicating them, and a fixture reference (`res_base`) resolves without a lookup.
 */
const NAMESPACE = 'nextkin.seed.v1';

export function stableId(label: string): string {
  const hash = createHash('sha1').update(`${NAMESPACE}:${label}`).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
