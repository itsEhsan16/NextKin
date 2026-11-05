import { describe, expect, it } from 'vitest';

import { BACKUP_CODE, backupCodeHash, newBackupCodes, newTemporaryPassword, openSecret, sealSecret, totpStep } from '../src/auth/staff/crypto';
import { networkAllows, parseCidr } from '../src/auth/staff/networks';
import { isStaffSessionRef, staffAware } from '../src/auth/staff/providerGuard';
import { staffPasswordProblem } from '../src/auth/staff/service';
import { newTotpSecret, totpAt } from '../src/auth/totp';
import type { IdentityProvider } from '../src/auth/ports/identity';

/** The staff sign-in's pure parts (toreview §171.13). The steps run against Postgres in adminStaffPortal.int.test.ts. */

describe('sealed authenticator secrets', () => {
  it('open under the same key only, and refuse an altered value', () => {
    const secret = newTotpSecret();
    const sealed = sealSecret('a key that is long enough to use here', secret);
    expect(sealed).not.toContain(secret);
    expect(openSecret('a key that is long enough to use here', sealed)).toBe(secret);
    expect(openSecret('another key, so the seal does not open', sealed)).toBeNull();
    const [v, iv, body, tag] = sealed.split('.');
    expect(openSecret('a key that is long enough to use here', [v, iv, `${body}A`, tag].join('.'))).toBeNull();
  });
});

describe('authenticator codes', () => {
  it('match their own step or one either side, and nothing else', () => {
    const secret = newTotpSecret();
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 30_000);
    expect(totpStep(secret, totpAt(secret, now), now)).toBe(step);
    expect(totpStep(secret, totpAt(secret, now - 30_000), now)).toBe(step - 1);
    expect(totpStep(secret, totpAt(secret, now + 30_000), now)).toBe(step + 1);
    expect(totpStep(secret, totpAt(secret, now - 90_000), now)).toBeNull();
    expect(totpStep(secret, '12345', now)).toBeNull();
  });
});

describe('backup codes and temporary passwords', () => {
  it('are the shapes the sign-in card asks for, and distinct', () => {
    const codes = newBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(BACKUP_CODE);
    expect(backupCodeHash('k'.repeat(32), codes[0]!.toUpperCase())).toBe(backupCodeHash('k'.repeat(32), codes[0]!));
    expect(newTemporaryPassword()).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
  });

  it('a staff password is at least 12 characters and not common', () => {
    expect(staffPasswordProblem('short pass', 'ada@nextkin.test')).toMatch(/12 characters/);
    expect(staffPasswordProblem('a long enough staff passphrase', 'ada@nextkin.test')).toBeNull();
  });
});

describe('allowed networks', () => {
  it('an empty list allows everyone; a list allows only its ranges', () => {
    expect(networkAllows([], '198.51.100.7')).toBe(true);
    const office = [{ cidr: '203.0.113.0/24', label: 'Office' }, { cidr: '2001:db8::/32', label: 'VPN' }];
    expect(networkAllows(office, '203.0.113.9')).toBe(true);
    expect(networkAllows(office, '::ffff:203.0.113.9')).toBe(true);
    expect(networkAllows(office, '2001:db8:1::5')).toBe(true);
    expect(networkAllows(office, '198.51.100.7')).toBe(false);
    expect(networkAllows(office, 'unknown')).toBe(false);
    expect(parseCidr('203.0.113.300/24')).toBeNull();
    expect(parseCidr('203.0.113.7')).toMatchObject({ prefix: 32 });
  });
});

describe('the provider guard', () => {
  it('never sends a staff session or sub to the users’ identity provider', async () => {
    const calls: string[] = [];
    const idp = { revokeSession: async (ref: string) => void calls.push(`revoke ${ref}`), globalSignOut: async (sub: string) => void calls.push(`out ${sub}`) } as unknown as IdentityProvider;
    const guarded = staffAware(idp);
    await guarded.revokeSession('staff:abc');
    await guarded.globalSignOut('staff|123');
    await guarded.revokeSession('sess_clerk');
    expect(calls).toEqual(['revoke sess_clerk']);
    expect(isStaffSessionRef('staff:x')).toBe(true);
  });
});
