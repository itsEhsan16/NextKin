import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import { totpAt } from '../totp';

/**
 * Secrets of the staff sign-in (toreview §171.13). The authenticator secret is stored sealed with
 * AES-256-GCM under a key derived from STAFF_TOTP_KEY, so a database dump alone can't mint codes.
 * Backup codes are stored as keyed hashes (HMAC-SHA-256): they carry 40 bits each, too few for a
 * plain hash to resist guessing offline, and sign-in locks the account after a few wrong tries.
 */

const keyFrom = (secret: string, purpose: string) => createHash('sha256').update(`nextkin-staff:${purpose}:${secret}`).digest();

export function sealSecret(key: string, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(key, 'totp'), iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), body.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
}

/** `null` when the value was sealed under another key (STAFF_TOTP_KEY changed) or was altered. */
export function openSecret(key: string, sealed: string): string | null {
  const [version, iv, body, tag] = sealed.split('.');
  if (version !== 'v1' || !iv || !body || !tag) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyFrom(key, 'totp'), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * The 30-second step a six-digit code belongs to, allowing one step of clock drift either way, or
 * `null`. Sign-in refuses a step at or before the last one used, so a code works once.
 */
export function totpStep(secret: string, code: string, nowMs = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = Math.floor(nowMs / 30_000);
  for (const step of [now - 1, now, now + 1]) {
    if (timingSafeEqual(Buffer.from(totpAt(secret, step * 30_000)), Buffer.from(code))) return step;
  }
  return null;
}

/** Backup codes look like `4f2a-9c10`: what the sign-in card asks for. */
export const BACKUP_CODE = /^[0-9a-f]{4}-[0-9a-f]{4}$/;
export const BACKUP_CODE_COUNT = 10;

export function newBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    const hex = randomBytes(4).toString('hex');
    codes.add(`${hex.slice(0, 4)}-${hex.slice(4)}`);
  }
  return [...codes];
}

export function backupCodeHash(key: string, code: string): string {
  return createHmac('sha256', keyFrom(key, 'backup')).update(code.trim().toLowerCase()).digest('hex');
}

// No look-alikes (0/O, 1/l/I), so a temporary password read out or copied by hand still works.
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A temporary password for a new or reset staff account: 16 characters in four groups (~92 bits). */
export function newTemporaryPassword(): string {
  const groups = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join(''));
  return groups.join('-');
}
