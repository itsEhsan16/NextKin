import { describe, expect, it } from 'vitest';
import { hashPassword, passwordProblem, verifyAgainstDummy, verifyPassword } from '../src/auth/password';
import { pkcePair } from '../src/auth/oidc';
import { readSessionCookie, sessionCookie, SESSION_COOKIE } from '../src/auth/sessions';
import { base32Decode, base32Encode, newTotpSecret, totpAt, verifyTotp } from '../src/auth/totp';
import { roleFrom } from '../src/auth/users';
import { createHash } from 'node:crypto';

/** Unit tests for the identity building blocks (ImBackendImplementationPlan P4). No Docker. */

describe('TOTP (RFC 6238)', () => {
  // RFC 6238 Appendix B, SHA-1, secret "12345678901234567890"; 6-digit codes are the last six.
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('at %i s the code is %s', (seconds, code) => {
    expect(totpAt(secret, seconds * 1000)).toBe(code);
  });

  it('accepts one step of clock drift either way and nothing beyond', () => {
    const now = 1_700_000_000_000;
    expect(verifyTotp(secret, totpAt(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpAt(secret, now + 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpAt(secret, now - 90_000), now)).toBe(false);
    expect(verifyTotp(secret, 'abcdef', now)).toBe(false);
    expect(verifyTotp(secret, '12345', now)).toBe(false);
  });

  it('base32 round-trips and new secrets are 160 bits', () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 255, 7]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    expect(base32Decode(newTotpSecret())).toHaveLength(20);
  });
});

describe('password policy', () => {
  it('refuses short, long, common and email-derived passwords', () => {
    expect(passwordProblem('short', 'a@b.test')).toBe('too_short');
    expect(passwordProblem('x'.repeat(129), 'a@b.test')).toBe('too_long');
    expect(passwordProblem('Password123', 'a@b.test')).toBe('too_common');
    expect(passwordProblem('robin.smith-2026', 'robin.smith@b.test')).toBe('contains_email');
    expect(passwordProblem('correct horse battery staple', 'robin@b.test')).toBeNull();
  });

  it('hashes with argon2id and verifies; a missing or broken hash never verifies', async () => {
    const hashed = await hashPassword('correct horse battery staple');
    expect(hashed).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hashed, 'correct horse battery staple')).toBe(true);
    expect(await verifyPassword(hashed, 'wrong')).toBe(false);
    expect(await verifyPassword(null, 'anything')).toBe(false);
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
    expect(await verifyAgainstDummy('anything')).toBe(false);
  });
});

describe('session cookie', () => {
  it('is __Host- scoped, HttpOnly, Secure, SameSite=Lax, 30 days', () => {
    expect(sessionCookie('abc')).toBe(`${SESSION_COOKIE}=abc; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  });

  it('is found among other cookies and ignored when absent or empty', () => {
    expect(readSessionCookie(`theme=dark; ${SESSION_COOKIE}=id-1; other=2`)).toBe('id-1');
    expect(readSessionCookie('theme=dark')).toBeNull();
    expect(readSessionCookie(`${SESSION_COOKIE}=`)).toBeNull();
    expect(readSessionCookie(undefined)).toBeNull();
    // A look-alike name is not the session cookie.
    expect(readSessionCookie('nk_session=evil')).toBeNull();
  });
});

describe('PKCE', () => {
  it('the challenge is the S256 of the verifier, and verifiers are long and unique', () => {
    const a = pkcePair();
    const b = pkcePair();
    expect(a.challenge).toBe(createHash('sha256').update(a.verifier).digest('base64url'));
    expect(a.verifier.length).toBeGreaterThanOrEqual(43);
    expect(a.verifier).not.toBe(b.verifier);
  });
});

describe('role from identity groups', () => {
  const profile = (pool: 'users' | 'admins', groups: string[]) => ({ sub: 's', email: 'e', emailVerified: true, name: null, pool, groups });
  it('users-pool accounts are always users, whatever groups they claim', () => {
    expect(roleFrom(profile('users', ['admin']))).toBe('user');
  });
  it('staff roles come from admins-pool groups; super_admin alone means admin; nothing means least privilege', () => {
    expect(roleFrom(profile('admins', ['curator']))).toBe('curator');
    expect(roleFrom(profile('admins', ['admin', 'super_admin']))).toBe('admin');
    expect(roleFrom(profile('admins', ['super_admin']))).toBe('admin');
    expect(roleFrom(profile('admins', []))).toBe('support');
  });
});
