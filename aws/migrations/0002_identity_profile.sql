-- 0002 · Identity and the career profile (spec §10, §7.1, §7.3; plan M1-07, D-21).
-- Credentials, OAuth identities and MFA secrets live only in the identity provider; this is the
-- application mirror. Every profile fact carries its provenance so the claim ledger (Q-03) can
-- cite it: typed by the user, parsed from an upload and confirmed, or assumed by Zero Resume Mode.

CREATE TABLE app.users (
  id                  uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  identity_sub        text NOT NULL UNIQUE,                  -- Cognito `sub` (or the local IdP's)
  email               citext NOT NULL UNIQUE,
  email_verified      boolean NOT NULL DEFAULT false,
  first_name          text NOT NULL DEFAULT '' CHECK (length(first_name) <= 100),
  last_name           text NOT NULL DEFAULT '' CHECK (length(last_name) <= 100),
  avatar_key          text,                                  -- object key, never a public URL
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  role                text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'curator', 'support')),
  mfa_enforced        boolean NOT NULL DEFAULT false,
  password_changed_at timestamptz,
  deletion_requested_at timestamptz,
  row_version         integer NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER users_touch BEFORE UPDATE ON app.users FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER users_version BEFORE UPDATE ON app.users FOR EACH ROW EXECUTE FUNCTION app.bump_row_version();
-- A user row is owned by itself.
SELECT app.apply_owner_rls('app.users', 'id');

-- Per-user application and privacy settings (the client's AppSettings / PrivacySettings). Distinct
-- from app.app_settings, which is the admin-managed global configuration.
CREATE TABLE app.user_settings (
  user_id          uuid PRIMARY KEY REFERENCES app.users (id) ON DELETE CASCADE,
  app_settings     jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(app_settings) = 'object'),
  privacy_settings jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(privacy_settings) = 'object'),
  row_version      integer NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER user_settings_touch BEFORE UPDATE ON app.user_settings FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER user_settings_version BEFORE UPDATE ON app.user_settings FOR EACH ROW EXECUTE FUNCTION app.bump_row_version();
SELECT app.apply_owner_rls('app.user_settings');

-- One profile per user. `phone` is a contact detail: it is merged into documents at render time
-- and never sent to an AI provider (G5). `preferences` holds job preferences and the per-channel
-- notification preferences reserved for Release 2 (§17.3).
CREATE TABLE app.profiles (
  user_id          uuid PRIMARY KEY REFERENCES app.users (id) ON DELETE CASCADE,
  org_id           uuid,
  headline         text CHECK (length(headline) <= 200),
  location         text CHECK (length(location) <= 200),
  visa_status      text CHECK (length(visa_status) <= 200),
  years_experience smallint CHECK (years_experience BETWEEN 0 AND 70),
  phone            text CHECK (length(phone) <= 40),
  bio              text CHECK (length(bio) <= 4000),
  tagline          text CHECK (length(tagline) <= 200),
  preferences      jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(preferences) = 'object'),
  -- Derived from the data on every write (§7.3 weights), never moved by a tapped step.
  completeness_bps integer NOT NULL DEFAULT 0 CHECK (completeness_bps BETWEEN 0 AND 10000),
  row_version      integer NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER profiles_touch BEFORE UPDATE ON app.profiles FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER profiles_version BEFORE UPDATE ON app.profiles FOR EACH ROW EXECUTE FUNCTION app.bump_row_version();
SELECT app.apply_owner_rls('app.profiles', 'user_id', true);

-- Dated roles: the ground truth for timeline validation (§7.7). Dates carry their precision,
-- because people often know only the month or the year.
CREATE TABLE app.experience (
  id               uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id          uuid NOT NULL REFERENCES app.profiles (user_id) ON DELETE CASCADE,
  company          text NOT NULL CHECK (length(company) BETWEEN 1 AND 200),
  title            text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  location         text CHECK (length(location) <= 200),
  employment_type  text CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'internship', 'freelance')),
  start_date       date NOT NULL,
  start_precision  text NOT NULL DEFAULT 'month' CHECK (start_precision IN ('day', 'month', 'year')),
  end_date         date,
  end_precision    text CHECK (end_precision IN ('day', 'month', 'year')),
  is_current       boolean NOT NULL DEFAULT false,
  description      text CHECK (length(description) <= 4000),
  responsibilities text[] NOT NULL DEFAULT '{}',
  provenance       text NOT NULL DEFAULT 'user' CHECK (provenance IN ('user', 'parsed_confirmed', 'assumed')),
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  CHECK (NOT is_current OR end_date IS NULL),
  CHECK (end_date IS NULL OR end_date >= start_date),
  CHECK ((end_date IS NULL) = (end_precision IS NULL))
);
CREATE INDEX experience_user_idx ON app.experience (user_id, start_date DESC);
CREATE TRIGGER experience_touch BEFORE UPDATE ON app.experience FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_owner_rls('app.experience');

CREATE TABLE app.education (
  id              uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id         uuid NOT NULL REFERENCES app.profiles (user_id) ON DELETE CASCADE,
  institution     text NOT NULL CHECK (length(institution) BETWEEN 1 AND 200),
  degree          text NOT NULL CHECK (length(degree) BETWEEN 1 AND 200),
  field           text CHECK (length(field) <= 200),
  start_date      date,
  start_precision text CHECK (start_precision IN ('day', 'month', 'year')),
  end_date        date,
  end_precision   text CHECK (end_precision IN ('day', 'month', 'year')),
  is_current      boolean NOT NULL DEFAULT false,
  provenance      text NOT NULL DEFAULT 'user' CHECK (provenance IN ('user', 'parsed_confirmed', 'assumed')),
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT is_current OR end_date IS NULL),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX education_user_idx ON app.education (user_id);
CREATE TRIGGER education_touch BEFORE UPDATE ON app.education FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_owner_rls('app.education');

CREATE TABLE app.certifications (
  id             uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id        uuid NOT NULL REFERENCES app.profiles (user_id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  issuer         text NOT NULL CHECK (length(issuer) BETWEEN 1 AND 200),
  issued_on      date,
  expires_on     date,
  credential_url text CHECK (credential_url ~ '^https?://' AND length(credential_url) <= 2000),
  provenance     text NOT NULL DEFAULT 'user' CHECK (provenance IN ('user', 'parsed_confirmed', 'assumed')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_on IS NULL OR issued_on IS NULL OR expires_on >= issued_on)
);
CREATE INDEX certifications_user_idx ON app.certifications (user_id);
CREATE TRIGGER certifications_touch BEFORE UPDATE ON app.certifications FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_owner_rls('app.certifications');

-- D-21: projects get a home in the profile so project claims are grounded like any other.
CREATE TABLE app.projects (
  id          uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id     uuid NOT NULL REFERENCES app.profiles (user_id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  description text CHECK (length(description) <= 4000),
  url         text CHECK (url ~ '^https?://' AND length(url) <= 2000),
  start_date  date,
  end_date    date,
  provenance  text NOT NULL DEFAULT 'user' CHECK (provenance IN ('user', 'parsed_confirmed', 'assumed')),
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX projects_user_idx ON app.projects (user_id);
CREATE TRIGGER projects_touch BEFORE UPDATE ON app.projects FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_owner_rls('app.projects');

CREATE TABLE app.profile_links (
  id         uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id    uuid NOT NULL REFERENCES app.profiles (user_id) ON DELETE CASCADE,
  label      text NOT NULL CHECK (length(label) BETWEEN 1 AND 100),
  url        text NOT NULL CHECK (url ~ '^https?://' AND length(url) <= 2000),
  kind       text CHECK (kind IN ('portfolio', 'linkedin', 'github', 'website', 'other')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profile_links_user_idx ON app.profile_links (user_id);
CREATE TRIGGER profile_links_touch BEFORE UPDATE ON app.profile_links FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
SELECT app.apply_owner_rls('app.profile_links');
