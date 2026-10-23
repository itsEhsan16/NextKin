import { createHmac, timingSafeEqual } from 'node:crypto';
import { errors } from './errors';

/**
 * Keyset pagination cursors (ImBackendImplementationPlan P3-05, spec §11). A cursor is the last
 * row's sort key and id, base64url-encoded and HMAC-signed, so a client can pass it back but cannot
 * forge or edit one. Keyset (not offset) pagination stays fast at any depth and never skips or
 * repeats a row when rows are inserted between pages.
 */
export interface CursorPosition {
  /** The sort column's value for the last row returned. */
  k: string;
  /** The last row's id: the tie-breaker. */
  i: string;
}

export function encodeCursor(position: CursorPosition, secret: string): string {
  const payload = Buffer.from(JSON.stringify(position)).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function decodeCursor(cursor: string, secret: string): CursorPosition {
  const [payload, signature] = cursor.split('.');
  if (!payload || !signature) throw errors.validation({ cursor: 'malformed' }, 'The cursor is not valid.');
  const expected = createHmac('sha256', secret).update(payload).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw errors.validation({ cursor: 'tampered' }, 'The cursor is not valid.');
  }
  try {
    const position = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as CursorPosition;
    if (typeof position.k !== 'string' || typeof position.i !== 'string') throw new Error('shape');
    return position;
  } catch {
    throw errors.validation({ cursor: 'malformed' }, 'The cursor is not valid.');
  }
}
