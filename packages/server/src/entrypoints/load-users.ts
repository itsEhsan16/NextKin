import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import Valkey from 'iovalkey';

import { buildIdentity } from '../auth/build';
import { AI_PROVIDER_LIST } from '@nextkin/shared/models/consent';
import { loadConfig } from '../config';
import { createDatabase } from '../db/database';
import { codeFrom, createMemoryEmail } from '../email/email';

/**
 * Load-test users (ImBackendImplementationPlan P13-03). Local and test only.
 *
 *   pnpm load:users [count]      signs in `count` synthetic Pro users (default 30), consented to AI,
 *                                with their monthly usage reset; writes their bearer tokens to
 *                                tests/load/.tokens.json (gitignored) for the k6 scripts
 *   pnpm load:users -- --remove  deletes them again (identity included)
 *
 * Sign-in goes through the identity adapter in-process, not the HTTP route: the route's per-IP
 * limit (10 a minute) would make preparing 30 users take minutes. The tokens are real ones the API
 * verifies like any other. Synthetic addresses only (L4).
 */
const config = loadConfig();
if (!['local', 'test'].includes(config.APP_ENV)) {
  console.error('load:users makes accounts with a known password and is refused outside local and test.');
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => a !== '--');
const remove = args.includes('--remove');
const count = Number(args.find((a) => /^\d+$/.test(a)) ?? 30);
const PASSWORD = 'Load-test-password-1';
const DOMAIN = 'load.nextkin.test';
const OUT = join(import.meta.dirname, '../../../../tests/load/.tokens.json');

const db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL });
const valkey = new Valkey(config.VALKEY_URL);
const email = createMemoryEmail();
const stack = buildIdentity(config, db, valkey, { email });
const { idp, auth } = stack.identity;

try {
  if (remove) {
    const users = await db.withSystem('load users: list', (tx) => tx.selectFrom('users').select(['id', 'identity_sub']).where('email', 'like', `load-%@${DOMAIN}`).execute());
    for (const u of users) await idp.deleteAccount(u.identity_sub);
    if (users.length) await db.withSystem('load users: remove', (tx) => tx.deleteFrom('users').where('id', 'in', users.map((u) => u.id)).execute());
    console.log(`removed ${users.length} load users`);
  } else {
    const tokens: string[] = [];
    for (let i = 0; i < count; i++) {
      const address = `load-${String(i).padStart(3, '0')}@${DOMAIN}`;
      const first = await idp.signIn({ email: address, password: PASSWORD, pool: 'users', clientId: 'nextkin-mobile' }).catch(() => null);
      let result = first;
      if (!result) {
        await idp.signUp({ email: address, password: PASSWORD, name: `Load User${i}` });
        await idp.confirmSignUp(address, codeFrom(email.lastTo(address))!);
        result = await idp.signIn({ email: address, password: PASSWORD, pool: 'users', clientId: 'nextkin-mobile' });
      }
      const signedIn = await auth.complete(result, 'mobile', { device: 'phone', platform: 'k6' });
      const userId = signedIn.user.id;
      await db.withUser({ userId, role: 'user' }, async (tx) => {
        const consented = await tx.selectFrom('consents').select('id').where('kind', '=', 'ai_processing').where('withdrawn_at', 'is', null).executeTakeFirst();
        if (!consented) await tx.insertInto('consents').values({ user_id: userId, kind: 'ai_processing', document_version: AI_PROVIDER_LIST.version }).execute();
        // A generation needs at least one role to build from (else it fails fast as profile_empty).
        const role = await tx.selectFrom('experience').select('id').executeTakeFirst();
        if (!role) {
          const { id } = await tx
            .insertInto('experience')
            .values({ user_id: userId, company: 'Synthetic Freight Co', title: 'Software Engineer', start_date: '2021-03-01', description: 'Built route-planning services in TypeScript and PostgreSQL.' })
            .returning('id')
            .executeTakeFirstOrThrow();
          await tx.insertInto('experience_skills').values(['TypeScript', 'PostgreSQL'].map((raw_name) => ({ user_id: userId, experience_id: id, raw_name }))).execute();
        }
        const pro = await tx.selectFrom('subscriptions').select('id').where('status', '=', 'active').executeTakeFirst();
        if (!pro) {
          const account = await tx.insertInto('billing_accounts').values({ owner_user_id: userId }).returning('id').executeTakeFirstOrThrow();
          await tx.insertInto('subscriptions').values({ billing_account_id: account.id, user_id: userId, plan_id: 'pro_monthly', status: 'active' }).execute();
        }
      });
      // Each run starts with the month's allowance intact, so repeated baselines measure the same thing.
      await db.withSystem('load users: reset usage', (tx) => tx.updateTable('usage_counters').set({ used: 0, reserved: 0 }).where('user_id', '=', userId).execute());
      tokens.push(signedIn.tokens!.accessToken);
    }
    mkdirSync(join(OUT, '..'), { recursive: true });
    writeFileSync(OUT, JSON.stringify(tokens));
    console.log(`${tokens.length} load users ready; tokens in tests/load/.tokens.json (valid 60 minutes)`);
  }
} finally {
  await stack.close();
  valkey.disconnect();
  await db.destroy();
}
