# Key rotation

**Owner role:** Security lead

Rotate on schedule (every 90 days for provider keys, every year for signing keys) and at once when
a key may have leaked. A leaked key is also a [security incident](security-incident.md).

## Inventory

| Secret                         | Where it lives                                         | Rotation effect                                   |
| ------------------------------ | ------------------------------------------------------ | ------------------------------------------------- |
| Database role passwords        | `.env` locally; Secrets Manager (X-05)                 | Pools reconnect; rolling restart                  |
| `CURSOR_SECRET`                | `.env`; Secrets Manager                                | Open pagination cursors become invalid (clients restart from page one) |
| Identity signing keys          | Local IdP: `local_idp.signing_keys`; Cognito (X-07)    | See below                                         |
| `FEDERATION_CLIENT_SECRET`     | `.env`; Secrets Manager                                | Federated sign-in fails until both sides match    |
| `ANTHROPIC_API_KEY`            | A developer's `.env` only; refused in staging and production | IAM-only invocation in the cloud (X-10)     |
| Job provider keys              | `SecretsPort`, written through `PUT /admin/providers/{provider}/key` | Takes effect without a deploy        |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `.env`; Secrets Manager (X-13)           | Webhooks fail signature checks until both match   |
| SMTP / SES credentials         | `.env`; IAM role in the cloud (X-08)                   | Email fails; the `email` degraded mode shows      |

## Steps

1. **Create the new secret first**, at the provider or in Secrets Manager, while the old one still
   works.
2. **Switch the app.**
   - Admin-managed provider keys: `PUT /api/v1/admin/providers/{provider}/key`. The call is
     write-only and audited, never displayed again, and takes effect without a deploy.
   - Everything else: update the secret, then do a rolling restart (cloud). Locally, edit `.env`
     and restart `dev:all`.
3. **Verify.** Watch `/api/v1/health/deep` and `/health/features`, and run one call that uses the
   key.
4. **Revoke the old secret** at the provider. For a suspected leak, revoke at once, before step 3.
   A short outage is better than a live leaked key.
5. **Record it** in the audit trail (admin key writes do this themselves) and in the incident, if
   there is one.

## Signing keys

- **Local IdP:** the newest row in `local_idp.signing_keys` signs, and every row is published in
  the JWKS. To rotate, insert a new key. Delete the old row only after the longest token lifetime
  has passed: 60 minutes for access tokens. Refresh tokens are opaque and stored server-side, so
  they are unaffected.
- **Cognito (X-07):** Cognito rotates its own keys. The API caches the JWKS and refetches on an
  unknown `kid`.
- **Ending every session** (a signing key leaked): delete the sessions, and every user signs in
  again. Locally that means clearing `sessions` and flushing Valkey. The admin suspend path ends one
  user's sessions.

## Detection

`pnpm scan:secrets` runs gitleaks over the history and the working tree (`.gitleaks.toml`), and CI
runs it on every push (X-06). A finding there means rotate, not just delete: git history is public
to everyone who has cloned it.
