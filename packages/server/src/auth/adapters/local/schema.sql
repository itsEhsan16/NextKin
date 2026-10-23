-- The local identity provider's own store (ImBackendImplementationPlan P4-02). A stand-in for
-- Cognito, so it lives in its own schema and is applied only when IDENTITY_ADAPTER=local, by
-- `pnpm migrate`, never through aws/migrations. It never reaches a deployed database (L3).
-- Idempotent: safe to apply on every migrate.

CREATE SCHEMA IF NOT EXISTS local_idp AUTHORIZATION nextkin_owner;
GRANT USAGE ON SCHEMA local_idp TO nextkin_app;

CREATE TABLE IF NOT EXISTS local_idp.accounts (
  sub             text PRIMARY KEY,
  pool            text NOT NULL CHECK (pool IN ('users', 'admins')),
  email           citext NOT NULL,
  email_verified  boolean NOT NULL DEFAULT false,
  password_hash   text,                         -- null for a federated-only account
  name            text,
  groups          text[] NOT NULL DEFAULT '{}',
  totp_secret     text,                         -- admins pool: MFA required
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool, email)
);

-- Federated identities linked to an account (Google, Apple). One account, many identities.
CREATE TABLE IF NOT EXISTS local_idp.identities (
  provider     text NOT NULL CHECK (provider IN ('google', 'apple')),
  provider_sub text NOT NULL,
  sub          text NOT NULL REFERENCES local_idp.accounts (sub) ON DELETE CASCADE,
  linked_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_sub)
);

-- Single-use, time-limited codes, stored hashed.
CREATE TABLE IF NOT EXISTS local_idp.codes (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pool         text NOT NULL,
  email        citext NOT NULL,
  purpose      text NOT NULL CHECK (purpose IN ('confirm_sign_up', 'reset_password')),
  code_hash    text NOT NULL,
  pending      jsonb,                           -- e.g. the password hash a sign-up will set
  attempts     integer NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
-- P5-06 added email changes; re-stated so an existing local database picks the purpose up.
ALTER TABLE local_idp.codes DROP CONSTRAINT IF EXISTS codes_purpose_check;
ALTER TABLE local_idp.codes ADD CONSTRAINT codes_purpose_check CHECK (purpose IN ('confirm_sign_up', 'reset_password', 'change_email'));
CREATE INDEX IF NOT EXISTS codes_lookup_idx ON local_idp.codes (pool, email, purpose, created_at DESC);

-- Refresh tokens, hashed, rotated on every use. A family is one sign-in session; reuse of a
-- rotated token revokes the whole family (refresh-token theft detection).
CREATE TABLE IF NOT EXISTS local_idp.refresh_tokens (
  token_hash  text PRIMARY KEY,
  family      text NOT NULL,                    -- the sessionRef
  sub         text NOT NULL REFERENCES local_idp.accounts (sub) ON DELETE CASCADE,
  client_id   text NOT NULL,
  expires_at  timestamptz NOT NULL,             -- the family's absolute 30-day lifetime
  rotated_at  timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_family_idx ON local_idp.refresh_tokens (family);
CREATE INDEX IF NOT EXISTS refresh_tokens_sub_idx ON local_idp.refresh_tokens (sub);

-- Token-signing keys (ES256), kept so tokens survive a restart. The newest is current.
CREATE TABLE IF NOT EXISTS local_idp.signing_keys (
  kid         text PRIMARY KEY,
  private_jwk jsonb NOT NULL,
  public_jwk  jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA local_idp TO nextkin_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA local_idp TO nextkin_app;
