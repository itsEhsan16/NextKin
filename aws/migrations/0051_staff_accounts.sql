-- 0051 · Staff accounts: the admin portal's own sign-in (toreview §171.13).
-- - Staff sign in with a password and an authenticator (TOTP), never through the users' identity
--   provider (Clerk today, Cognito later): the owner's decision of 2026-11-05. The account lives here,
--   so the same sign-in works under every IDENTITY_ADAPTER.
-- - A new account has a temporary password and no authenticator. Its first sign-in sets up the
--   authenticator, then asks for a new password (must_change_password) before any session exists.
-- - The TOTP secret is stored sealed (AES-256-GCM under STAFF_TOTP_KEY); backup codes as keyed hashes.
-- - Only the system role reads or writes these tables: sign-in happens before there is a session,
--   and every staff change goes through the staff service, which audits it in the same transaction.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE app.staff_accounts (
  id                    uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id               uuid NOT NULL UNIQUE REFERENCES app.users (id) ON DELETE CASCADE,
  email                 citext NOT NULL UNIQUE CHECK (length(email) BETWEEN 3 AND 254),
  name                  text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  role                  text NOT NULL CHECK (role IN ('support', 'curator', 'admin', 'super_admin')),
  status                text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'disabled')),
  password_hash         text NOT NULL,
  must_change_password  boolean NOT NULL DEFAULT true,
  password_changed_at   timestamptz,
  totp_sealed           text,
  totp_added_at         timestamptz,
  totp_last_step        bigint,
  totp_last_used_at     timestamptz,
  failed_attempts       integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until          timestamptz,
  last_sign_in_at       timestamptz,
  last_sign_in_ip       text CHECK (length(last_sign_in_ip) <= 64),
  invited_by            uuid REFERENCES app.users (id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.staff_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.staff_accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY staff_accounts_system ON app.staff_accounts TO nextkin_maintenance USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON app.staff_accounts TO nextkin_maintenance;

CREATE TABLE app.staff_backup_codes (
  id          uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  staff_id    uuid NOT NULL REFERENCES app.staff_accounts (id) ON DELETE CASCADE,
  code_hash   text NOT NULL CHECK (length(code_hash) = 64),
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, code_hash)
);
CREATE INDEX staff_backup_codes_staff_idx ON app.staff_backup_codes (staff_id) WHERE used_at IS NULL;
ALTER TABLE app.staff_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.staff_backup_codes FORCE ROW LEVEL SECURITY;
CREATE POLICY staff_backup_codes_system ON app.staff_backup_codes TO nextkin_maintenance USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON app.staff_backup_codes TO nextkin_maintenance;

-- The portal's access policy: one row. MFA itself is not a setting (always required).
CREATE TABLE app.admin_settings (
  id                        boolean PRIMARY KEY DEFAULT true CHECK (id),
  session_timeout_minutes   integer NOT NULL DEFAULT 30 CHECK (session_timeout_minutes IN (15, 30, 60, 120)),
  reauth_for_sensitive      boolean NOT NULL DEFAULT true,
  allowed_networks          jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(allowed_networks) = 'array'),
  updated_by                uuid REFERENCES app.users (id) ON DELETE SET NULL,
  updated_at                timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app.admin_settings DEFAULT VALUES;
ALTER TABLE app.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.admin_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_settings_system ON app.admin_settings TO nextkin_maintenance USING (true) WITH CHECK (true);
GRANT SELECT, UPDATE ON app.admin_settings TO nextkin_maintenance;
