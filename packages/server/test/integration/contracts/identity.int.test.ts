import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLocalIdentityProvider } from '../../../src/auth/adapters/local/provider';
import { pkcePair, randomToken } from '../../../src/auth/oidc';
import { AuthError, type FederatedProvider, type IdentityProvider } from '../../../src/auth/ports/identity';
import { totpAt } from '../../../src/auth/totp';
import { loadConfig } from '../../../src/config';
import { codeFrom, createMemoryEmail } from '../../../src/email/email';
import { setEgressAllowlist } from '../../../src/net/egress';
import { startFakeIssuer, type FakeIssuer } from '../fixtures/fakeIssuer';

/**
 * The identity contract suite (ImBackendImplementationPlan P4-09, L2). Every adapter of the
 * IdentityProvider port must pass it unchanged: the local stand-in now, Cognito at X-07. It pins
 * the behaviours the product relies on, not any provider's internals.
 */
const config = loadConfig();
const email = createMemoryEmail();
let pool: pg.Pool;
let google: FakeIssuer;
let apple: FakeIssuer;
const adminSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

const adapters: { name: string; make: () => IdentityProvider & { upsertAccount?: (...args: never[]) => Promise<void> } }[] = [
  { name: 'local', make: () => createLocalIdentityProvider({ pool, email, issuers: { google: google.config, apple: apple.config } }) },
];

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 4 });
  google = await startFakeIssuer('google');
  apple = await startFakeIssuer('apple');
  // The fake issuers listen on 127.0.0.1; token exchange goes through the egress guard (P11-06).
  setEgressAllowlist(['127.0.0.1']);
});

afterAll(async () => {
  await pool.query(`delete from local_idp.accounts where email like '%@contract.test'`);
  await pool.end();
  await google.close();
  await apple.close();
});

const address = () => `c-${randomUUID().slice(0, 8)}@contract.test`;
const PASSWORD = 'correct horse battery staple';

async function confirmedUser(idp: IdentityProvider, to = address()) {
  await idp.signUp({ email: to, password: PASSWORD, name: 'Casey Contract' });
  await idp.confirmSignUp(to, codeFrom(email.lastTo(to))!);
  return to;
}

async function federate(idp: IdentityProvider, provider: FederatedProvider, claims: { sub: string; email?: string; email_verified?: boolean; name?: string }, appleUser?: { name: { firstName: string; lastName: string } }) {
  const nonce = randomToken();
  const { verifier, challenge } = pkcePair();
  const redirectUri = 'http://localhost:3000/api/v1/auth/callback';
  const issuer = provider === 'google' ? google : apple;
  const code = issuer.issueCode({ claims, nonce, codeChallenge: challenge, redirectUri });
  return idp.completeFederated(provider, { code, codeVerifier: verifier, nonce, redirectUri, appleUser }, 'nextkin-web');
}

const rejects = async (promise: Promise<unknown>, failure: string) => {
  await expect(promise).rejects.toSatisfy((e) => e instanceof AuthError && e.failure === failure);
};

for (const adapter of adapters) {
  describe(`IdentityProvider contract: ${adapter.name}`, () => {
    const idp = () => adapter.make();

    it('sign-up sends a code; signing in before confirming is refused; after confirming it works', async () => {
      const to = address();
      await idp().signUp({ email: to, password: PASSWORD });
      await rejects(idp().signIn({ email: to, password: PASSWORD, pool: 'users', clientId: 'nextkin-web' }), 'not_confirmed');
      await idp().confirmSignUp(to, codeFrom(email.lastTo(to))!);
      const result = await idp().signIn({ email: to, password: PASSWORD, pool: 'users', clientId: 'nextkin-web' });
      expect(result.profile).toMatchObject({ email: to, emailVerified: true, pool: 'users' });
      expect(result.tokens.expiresIn).toBe(3600);
    });

    it('existence is never revealed: signing up an existing email answers the same and warns the owner', async () => {
      const to = await confirmedUser(idp());
      const before = email.sent.length;
      await expect(idp().signUp({ email: to, password: 'another long passphrase' })).resolves.toBeUndefined();
      expect(email.sent.length).toBe(before + 1);
      expect(email.lastTo(to)?.subject).toMatch(/tried to sign up/);
      await expect(idp().forgotPassword(`nobody-${randomUUID()}@contract.test`)).resolves.toBeUndefined();
    });

    it('wrong passwords and unknown emails fail the same way, and five failures lock the account', async () => {
      const to = await confirmedUser(idp());
      await rejects(idp().signIn({ email: `missing-${randomUUID()}@contract.test`, password: PASSWORD, pool: 'users', clientId: 'x' }), 'invalid_credentials');
      for (let i = 0; i < 5; i++) await rejects(idp().signIn({ email: to, password: 'wrong password!!', pool: 'users', clientId: 'x' }), 'invalid_credentials');
      await rejects(idp().signIn({ email: to, password: PASSWORD, pool: 'users', clientId: 'x' }), 'invalid_credentials');
    });

    it('weak and common passwords are refused, wrong codes are refused', async () => {
      await rejects(idp().signUp({ email: address(), password: 'short' }), 'weak_password');
      await rejects(idp().signUp({ email: address(), password: 'password123' }), 'weak_password');
      const to = address();
      await idp().signUp({ email: to, password: PASSWORD });
      await rejects(idp().confirmSignUp(to, '000000'), 'code_invalid');
    });

    it('access tokens verify with their session and groups; a forged token does not', async () => {
      const to = await confirmedUser(idp());
      const { tokens, profile } = await idp().signIn({ email: to, password: PASSWORD, pool: 'users', clientId: 'nextkin-mobile' });
      const verified = await idp().verifyAccessToken(tokens.accessToken);
      expect(verified).toMatchObject({ sub: profile.sub, sessionRef: tokens.sessionRef, clientId: 'nextkin-mobile', pool: 'users' });
      const [h, p] = tokens.accessToken.split('.');
      await rejects(idp().verifyAccessToken(`${h}.${p}.AAAA`), 'token_invalid');
      await rejects(idp().verifyAccessToken('not-a-token'), 'token_invalid');
    });

    it('refresh rotates; replaying a rotated token revokes the whole session', async () => {
      const to = await confirmedUser(idp());
      const first = (await idp().signIn({ email: to, password: PASSWORD, pool: 'users', clientId: 'nextkin-mobile' })).tokens;
      const second = await idp().refresh(first.refreshToken);
      expect(second.sessionRef).toBe(first.sessionRef);
      expect(second.refreshToken).not.toBe(first.refreshToken);
      await expect(idp().refresh(first.refreshToken)).rejects.toSatisfy((e) => e instanceof AuthError && e.failure === 'token_reused' && e.sessionRef === first.sessionRef);
      await rejects(idp().refresh(second.refreshToken), 'token_invalid');
    });

    it('revoking a session and signing out globally end refresh', async () => {
      const to = await confirmedUser(idp());
      const a = (await idp().signIn({ email: to, password: PASSWORD, pool: 'users', clientId: 'x' }));
      const b = (await idp().signIn({ email: to, password: PASSWORD, pool: 'users', clientId: 'x' }));
      await idp().revokeSession(a.tokens.sessionRef);
      await rejects(idp().refresh(a.tokens.refreshToken), 'token_invalid');
      await expect(idp().refresh(b.tokens.refreshToken)).resolves.toBeTruthy();
      await idp().globalSignOut(a.profile.sub);
      const c = await idp().signIn({ email: to, password: PASSWORD, pool: 'users', clientId: 'x' });
      expect(c.tokens.sessionRef).not.toBe(a.tokens.sessionRef);
    });

    it('changing or resetting the password ends every session', async () => {
      const to = await confirmedUser(idp());
      const session = await idp().signIn({ email: to, password: PASSWORD, pool: 'users', clientId: 'x' });
      await rejects(idp().changePassword(session.profile.sub, 'not the password', 'a brand new passphrase'), 'invalid_credentials');
      await idp().changePassword(session.profile.sub, PASSWORD, 'a brand new passphrase');
      await rejects(idp().refresh(session.tokens.refreshToken), 'token_invalid');
      await idp().forgotPassword(to);
      await idp().confirmForgotPassword(to, codeFrom(email.lastTo(to))!, 'yet another passphrase');
      await expect(idp().signIn({ email: to, password: 'yet another passphrase', pool: 'users', clientId: 'x' })).resolves.toBeTruthy();
    });

    it('the admins pool requires TOTP', async () => {
      const provider = idp() as ReturnType<typeof createLocalIdentityProvider>;
      const to = `admin-${randomUUID().slice(0, 6)}@contract.test`;
      await provider.upsertAccount({ sub: `local|contract-${randomUUID()}`, pool: 'admins', email: to, password: PASSWORD, groups: ['support'], totpSecret: adminSecret });
      await rejects(provider.signIn({ email: to, password: PASSWORD, pool: 'admins', clientId: 'nextkin-admin' }), 'mfa_required');
      await rejects(provider.signIn({ email: to, password: PASSWORD, pool: 'admins', clientId: 'nextkin-admin', totp: '000000' }), 'invalid_credentials');
      const ok = await provider.signIn({ email: to, password: PASSWORD, pool: 'admins', clientId: 'nextkin-admin', totp: totpAt(adminSecret, Date.now()) });
      expect(ok.profile.groups).toEqual(['support']);
      // A users-pool sign-in cannot reach an admins-pool account.
      await rejects(provider.signIn({ email: to, password: PASSWORD, pool: 'users', clientId: 'x' }), 'invalid_credentials');
    });

    describe('federation and account linking', () => {
      it('a first federated sign-in creates an account; the second finds the same one', async () => {
        const to = address();
        const first = await federate(idp(), 'google', { sub: `g-${randomUUID()}`, email: to, email_verified: true, name: 'Gina Google' });
        expect(first.linked).toBe(false);
        expect(first.profile).toMatchObject({ email: to, emailVerified: true, name: 'Gina Google' });
      });

      it('password first, then Google with the same verified email: one account', async () => {
        const to = await confirmedUser(idp());
        const password = await idp().signIn({ email: to, password: PASSWORD, pool: 'users', clientId: 'x' });
        const viaGoogle = await federate(idp(), 'google', { sub: `g-${randomUUID()}`, email: to, email_verified: true });
        expect(viaGoogle.linked).toBe(true);
        expect(viaGoogle.profile.sub).toBe(password.profile.sub);
      });

      it('Google first, then a password sign-up: the code proves the mailbox, then one account', async () => {
        const to = address();
        const viaGoogle = await federate(idp(), 'google', { sub: `g-${randomUUID()}`, email: to, email_verified: true });
        await idp().signUp({ email: to, password: PASSWORD });
        await rejects(idp().signIn({ email: to, password: PASSWORD, pool: 'users', clientId: 'x' }), 'invalid_credentials');
        await idp().confirmSignUp(to, codeFrom(email.lastTo(to))!);
        const password = await idp().signIn({ email: to, password: PASSWORD, pool: 'users', clientId: 'x' });
        expect(password.profile.sub).toBe(viaGoogle.profile.sub);
      });

      it('an unverified provider email never links to an existing account', async () => {
        const to = await confirmedUser(idp());
        await rejects(federate(idp(), 'google', { sub: `g-${randomUUID()}`, email: to, email_verified: false }), 'federation_failed');
      });

      it('Apple: the name arrives once, on the first authorization, and is kept', async () => {
        const appleSub = `a-${randomUUID()}`;
        const relay = `${randomUUID().slice(0, 8)}@privaterelay.appleid.com`;
        const first = await federate(idp(), 'apple', { sub: appleSub, email: relay, email_verified: true }, { name: { firstName: 'Avery', lastName: 'Apple' } });
        expect(first.profile.name).toBe('Avery Apple');
        const second = await federate(idp(), 'apple', { sub: appleSub, email: relay, email_verified: true });
        expect(second.profile.name).toBe('Avery Apple');
        expect(second.profile.sub).toBe(first.profile.sub);
        await pool.query('delete from local_idp.accounts where email = $1', [relay]);
      });

      it('a wrong PKCE verifier fails the exchange', async () => {
        const nonce = randomToken();
        const { challenge } = pkcePair();
        const redirectUri = 'http://localhost:3000/api/v1/auth/callback';
        const code = google.issueCode({ claims: { sub: 'g-x', email: address(), email_verified: true }, nonce, codeChallenge: challenge, redirectUri });
        await rejects(idp().completeFederated('google', { code, codeVerifier: 'wrong-verifier-wrong-verifier-wrong', nonce, redirectUri }, 'x'), 'federation_failed');
      });
    });

    describe('account changes (P5-06)', () => {
      it('email change: the code goes to the new address, and only confirming changes it', async () => {
        const from = await confirmedUser(idp());
        const { profile } = await idp().signIn({ email: from, password: PASSWORD, pool: 'users', clientId: 'x' });
        const to = address();
        await idp().requestEmailChange(profile.sub, to);
        await expect(idp().signIn({ email: to, password: PASSWORD, pool: 'users', clientId: 'x' })).rejects.toBeInstanceOf(AuthError);
        await rejects(idp().confirmEmailChange(profile.sub, '000000'), 'code_invalid');
        await expect(idp().confirmEmailChange(profile.sub, codeFrom(email.lastTo(to))!)).resolves.toEqual({ email: to });
        await expect(idp().signIn({ email: to, password: PASSWORD, pool: 'users', clientId: 'x' })).resolves.toBeTruthy();
      });

      it('email change to a taken address sends a notice and no code', async () => {
        const taken = await confirmedUser(idp());
        const { profile } = await idp().signIn({ email: await confirmedUser(idp()), password: PASSWORD, pool: 'users', clientId: 'x' });
        await idp().requestEmailChange(profile.sub, taken);
        expect(codeFrom(email.lastTo(taken))).toBeUndefined();
        await rejects(idp().confirmEmailChange(profile.sub, '123456'), 'code_invalid');
      });

      it('link, list and unlink a provider; a provider identity belongs to one account only', async () => {
        const one = await idp().signIn({ email: await confirmedUser(idp()), password: PASSWORD, pool: 'users', clientId: 'x' });
        const two = await idp().signIn({ email: await confirmedUser(idp()), password: PASSWORD, pool: 'users', clientId: 'x' });
        const googleSub = `g-${randomUUID()}`;
        const link = async (sub: string) => {
          const nonce = randomToken();
          const { verifier, challenge } = pkcePair();
          const redirectUri = 'http://localhost:3000/api/v1/auth/callback';
          const code = google.issueCode({ claims: { sub: googleSub, email: address(), email_verified: true }, nonce, codeChallenge: challenge, redirectUri });
          return idp().linkFederated(sub, 'google', { code, codeVerifier: verifier, nonce, redirectUri });
        };
        await link(one.profile.sub);
        expect((await idp().listIdentities(one.profile.sub)).map((i) => i.provider)).toEqual(['google']);
        await rejects(link(two.profile.sub), 'federation_failed');
        await idp().unlinkIdentity(one.profile.sub, 'google');
        expect(await idp().listIdentities(one.profile.sub)).toEqual([]);
      });

      it('the only sign-in method cannot be unlinked', async () => {
        const viaGoogle = await federate(idp(), 'google', { sub: `g-${randomUUID()}`, email: address(), email_verified: true });
        await rejects(idp().unlinkIdentity(viaGoogle.profile.sub, 'google'), 'last_sign_in_method');
      });
    });
  });
}
