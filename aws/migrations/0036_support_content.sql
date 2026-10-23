-- 0036 · P12-13 support: the FAQ and the legal documents as versioned content (one published version
-- per key is what users read; a new version is a new row, never an edit), and the tickets users send.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE app.content_documents (
  key          text NOT NULL CHECK (key IN ('faq', 'terms', 'privacy')),
  version      integer NOT NULL CHECK (version > 0),
  body         jsonb NOT NULL,
  published_at timestamptz,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, version)
);
SELECT app.apply_reference_rls('app.content_documents', 'published_at IS NOT NULL');

CREATE TABLE app.support_tickets (
  id         uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  user_id    uuid NOT NULL REFERENCES app.users (id) ON DELETE CASCADE,
  topic      text NOT NULL CHECK (topic IN ('question', 'bug', 'billing', 'account', 'feedback')),
  message    text NOT NULL CHECK (length(message) BETWEEN 1 AND 5000),
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_tickets_user_idx ON app.support_tickets (user_id, created_at DESC);
SELECT app.apply_owner_rls('app.support_tickets');
