import { randomUUID } from 'node:crypto';

import { hashPassword } from '../../../src/auth/password';
import { sealSecret } from '../../../src/auth/staff/crypto';
import { totpAt } from '../../../src/auth/totp';
import { LOCAL_STAFF_KEY } from '../../../src/http/routes/adminKit';
import type { StaffLevel } from '../../../src/services/admin/permissions';
import { SEED_TOTP_SECRET } from '../../../src/seed/identities';
import { cookieFrom, DOMAIN, ORIGIN, PASSWORD, type Harness } from './authHarness';

/**
 * Staff accounts for the suites (toreview §171.13): a users row plus an `app.staff_accounts` row,
 * on the suite's throwaway domain so the harness's cleanup removes both. `enrolled` gives the
 * account the seed's authenticator secret; `mustChange` leaves the temporary password in place.
 */
export interface TestStaff {
  userId: string;
  email: string;
  password: string;
  secret: string;
}

export async function makeStaff(h: Harness, level: StaffLevel, options: { enrolled?: boolean; mustChange?: boolean; email?: string } = {}): Promise<TestStaff> {
  const userId = randomUUID();
  const email = options.email ?? `staff-${level}-${userId.slice(0, 8)}@${DOMAIN}`;
  const role = level === 'super_admin' ? 'admin' : level;
  await h.db.withUser({ userId, role }, async (tx) => {
    await tx.insertInto('users').values({ id: userId, identity_sub: `staff|${userId}`, email, first_name: 'Test', last_name: level, role, mfa_enforced: true }).execute();
    await tx.insertInto('user_settings').values({ user_id: userId }).execute();
    await tx.insertInto('profiles').values({ user_id: userId }).execute();
  });
  const enrolled = options.enrolled ?? true;
  await h.db.withSystem('test: a staff account', (tx) =>
    tx
      .insertInto('staff_accounts')
      .values({
        user_id: userId,
        email,
        name: `Test ${level}`,
        role: level,
        status: enrolled && !options.mustChange ? 'active' : 'invited',
        password_hash: '',
        must_change_password: options.mustChange ?? false,
        totp_sealed: enrolled ? sealSecret(LOCAL_STAFF_KEY, SEED_TOTP_SECRET) : null,
        totp_added_at: enrolled ? new Date() : null,
      })
      .execute(),
  );
  const hash = await hashPassword(PASSWORD);
  await h.db.withSystem('test: a staff password', (tx) => tx.updateTable('staff_accounts').set({ password_hash: hash }).where('user_id', '=', userId).execute());
  return { userId, email, password: PASSWORD, secret: SEED_TOTP_SECRET };
}

/** Signs an enrolled staff account in through `/auth/admin/login` and returns the cookie. */
export async function staffLogin(h: Harness, member: TestStaff): Promise<string> {
  const res = await h.app.request('/api/v1/auth/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email: member.email, password: member.password, totp: totpAt(member.secret, Date.now()) }),
  });
  if (res.status !== 200) throw new Error(`staff login failed: ${res.status} ${await res.text()}`);
  return cookieFrom(res);
}
