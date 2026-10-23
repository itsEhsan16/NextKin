# Identity (P4)

How sign-in works on the backend, and the design of the mobile federated hand-off (P4-07, C-12).

**Audience:** engineers working on auth, the HTTP repositories (P5), or the Cognito adapter (X-07).

## Pieces

| File | Role |
|---|---|
| `ports/identity.ts` | The `IdentityProvider` port. It is shaped like Cognito, so X-07 is a new adapter, not a rewrite |
| `adapters/local/` | The local stand-in: argon2id, emailed codes, ES256 tokens, refresh rotation, lockout, admins pool with TOTP, Google/Apple through OIDC. It is refused outside `local` and `test` (L3) |
| `sessions.ts` | Server sessions: a Valkey record (`sess:<id>`) plus a durable `app.sessions` row |
| `authenticator.ts` | Resolves a request from a cookie (web) or a bearer token (mobile). Either way, the session record decides |
| `service.ts` | One place where a successful sign-in becomes a session, a user row (created just in time) and a security event |
| `../http/routes/auth.ts`, `authFederated.ts` | The `/api/v1/auth/*` routes |
| `packages/shared/src/auth` | The phone-safe client both apps use |

## Rules

- **Existence is never revealed.**
  - Sign-up, resend and forgot-password answer `202` whether or not the account exists.
  - A wrong password and an unknown email give the same `401`, after the same argon2 work.
- **Logout is immediate.**
  - Every request checks the server session, so deleting it ends a web cookie and a mobile access
    token alike, on the very next call.
  - This is the difference from bare JWTs, and `authSessions.int.test.ts` pins it.
- **What ends sessions:**
  - logout-all and a password reset end every session;
  - a password change ends all but the current one;
  - replaying a rotated refresh token ends that session (the theft signal).
- **Login CSRF.** A web sign-in must carry our `Origin`. Otherwise cookie writes need `Origin` plus
  a JSON body (P3 CSRF).
- **Linking happens only on a provider-verified email.** It works in both orderings:
  - password first, then Google: linked at the federated sign-in;
  - Google first, then a password sign-up: linked once the emailed code proves the mailbox.
- **Apple sends the user's name once,** on the first authorization only. It is stored then and
  never overwritten with empty values.
- **Staff use the admins pool and always need TOTP.** A users-pool sign-in cannot reach an
  admins-pool account. Roles come from the pool's groups at each sign-in.

## The mobile federated hand-off (C-12)

**The problem.** Mobile cannot use the provider's redirect directly:
- Expo Go's redirect is `exp://<lan-ip>:8081/--/…`, which changes per developer and network.
- Cognito, Google and Apple only accept registered redirect URIs.
- A token in a redirect URL ends up in logs, browser history and other apps' intent filters.

**The design: the server does the exchange.**

```
App                     API (/api/v1/auth)                  Provider
 | open in-app browser:    |                                    |
 |  /login/google?client=mobile&redirect=nextkin://auth/done   |
 |------------------------>| redirect must match the allowlist  |
 |                         | store {verifier, nonce, redirect}  |
 |                         |   at oauth:<state>, 10 min         |
 |                         |--- 302 authorize (PKCE S256) ----->|
 |                         |<-- callback ?code&state -----------|
 |                         | GETDEL state (single use)          |
 |                         | exchange code + verifier; check    |
 |                         |   the ID token (iss, aud, nonce)   |
 |                         | create session; park tokens at     |
 |                         |   handoff:<code>, 60 s             |
 |<-- 302 nextkin://auth/done?code=<one-time code> ------------|
 | POST /token/exchange {code}                                  |
 |------------------------>| GETDEL handoff:<code> -> tokens    |
 |<-- {user, tokens} ------|                                    |
```

**Properties:**
- **Only a 60-second, single-use code travels in the URL. Tokens never do.** The redirect target
  must start with an entry in `MOBILE_REDIRECT_ALLOWLIST`:
  - `nextkin://` in every environment;
  - `exp://` too, but only in `local` and `test` (L3 refuses it elsewhere).
- **PKCE, `state` and `nonce` live on the server.** The app holds no secret and has nothing to lose.
- **Replay is refused at both steps:** the second use of a `state` and the second use of a hand-off
  code each find nothing.
- **When Cognito arrives (X-07):**
  - the same flow runs against the Cognito Hosted UI, which redirects back to the API;
  - only the adapter changes. The app and its routes stay as they are.
  - `[verify at X-07]`: Cognito's app-client callback URL is the API's `/auth/callback`, not an
    app scheme.
- **On the app side** (P5, `expo-web-browser`):
  - `openAuthSessionAsync(client.federatedUrl('google', redirect), redirect)`;
  - then `client.exchange(code)`;
  - `redirect` is the value of `Linking.createURL('auth/done')`, which is `exp://…` in Expo Go and
    `nextkin://…` in store builds.
  - `[verify SDK 57]`: `openAuthSessionAsync` returns the final URL in Expo Go on both platforms.

## Running federation locally

- `pnpm stack:up -- --profile auth` starts mock-oauth2-server on `127.0.0.1:8090`, which serves the
  `google` and `apple` issuers.
- It shows a login form: type any `sub`, and claims such as
  `{"email":"you@example.test","email_verified":true,"name":"You"}`.
- The integration suites do not need it: they use an in-process issuer
  (`test/integration/fixtures/fakeIssuer.ts`).

## Seeded accounts (local only)

- `pnpm seed` creates local sign-ins for the role accounts and personas.
- Every account uses the password `NextKin-local-2026`.
- Staff accounts (`admin@`, `curator@` and `support@nextkin.test`) also need TOTP. Their secret is
  `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP`: add it to an authenticator app.
