-- 0001 · Foundation: the application schema and the helpers every later migration uses.
-- ImBackendImplementationPlan P2-02/P2-03/P2-04. Plain PostgreSQL 17: runs on the compose
-- database and on Aurora alike (aws/migrations/README.md).

-- Extensions the schema depends on. All three are trusted extensions, so the owner (CREATE on the
-- database) can install them on a fresh Aurora database; locally the bootstrap script already has.
-- [verify each is offered on Aurora PostgreSQL 17]
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA app;
GRANT USAGE ON SCHEMA app TO nextkin_app, nextkin_maintenance, nextkin_readonly;

-- ---------------------------------------------------------------------------------------------
-- Identifiers. The application issues UUIDv7 (time-ordered, so inserts append to the index and
-- ids cannot be enumerated). This default produces the same format for rows created in SQL.
CREATE FUNCTION app.uuid_v7() RETURNS uuid
LANGUAGE sql VOLATILE PARALLEL SAFE AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid())
                placing substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
                FROM 1 FOR 6),
        52, 1),
      53, 1),
    'hex')::uuid
$$;

-- ---------------------------------------------------------------------------------------------
-- The request's identity, bound per transaction by withUser() with set_config(..., true).
-- STABLE and simple, so the planner evaluates them once per statement and can use indexes.
CREATE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;

CREATE FUNCTION app.current_app_role() RETURNS text
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT coalesce(nullif(current_setting('app.role', true), ''), 'anonymous')
$$;

-- Organisation membership: DORMANT in Release 1 (spec §10 multi-tenancy note, G11). Every owner
-- policy already calls it, so enterprise workspaces become a migration that adds orgs/org_members
-- and replaces this body, not a redesign. It returns false today, and because it is a simple SQL
-- function the planner inlines it to a constant, so the dormant branch costs nothing.
CREATE FUNCTION app.is_org_member(p_org_id uuid) RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT false
$$;

-- ---------------------------------------------------------------------------------------------
-- Row bookkeeping.
CREATE FUNCTION app.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

-- Optimistic concurrency (ETag / If-Match, P3-06): every write to a versioned row bumps it.
CREATE FUNCTION app.bump_row_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.row_version := OLD.row_version + 1;
  RETURN NEW;
END
$$;

-- Append-only tables refuse UPDATE and DELETE outright, whatever the grants say.
CREATE FUNCTION app.refuse_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: the table is append-only', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END
$$;

-- ---------------------------------------------------------------------------------------------
-- Row-level security for a user-owned table (G7), in one call so no table can get it half right.
--   * ENABLE + FORCE (FORCE so even the owner is subject to it).
--   * nextkin_app: a user sees and writes only their own rows; the org branch is dormant.
--   * nextkin_maintenance: purge and sweep jobs (withSystem), every use logged by the app.
--   * nextkin_readonly: support/admin reads, only when an admin identity bound app.role, and
--     audited in application code. Kept off the app role so the user path stays a single,
--     index-friendly predicate.
-- Every later migration that adds a user-owned table calls this in the same file
-- (aws/migrations/README.md rule 3), and the RLS suite fails any table that skips it.
CREATE FUNCTION app.apply_owner_rls(p_table regclass, p_owner_column text DEFAULT 'user_id', p_has_org boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_predicate text;
BEGIN
  v_predicate := format('%I = app.current_user_id()', p_owner_column);
  IF p_has_org THEN
    v_predicate := v_predicate || ' OR (org_id IS NOT NULL AND app.is_org_member(org_id))';
  END IF;

  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', p_table);
  EXECUTE format('CREATE POLICY owner_access ON %s TO nextkin_app USING (%s) WITH CHECK (%s)',
                 p_table, v_predicate, v_predicate);
  EXECUTE format('CREATE POLICY maintenance_access ON %s TO nextkin_maintenance USING (true) WITH CHECK (true)', p_table);
  EXECUTE format($p$CREATE POLICY staff_read ON %s FOR SELECT TO nextkin_readonly
                   USING (app.current_app_role() IN ('admin', 'support', 'curator'))$p$, p_table);

  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO nextkin_app', p_table);
  EXECUTE format('GRANT SELECT, UPDATE, DELETE ON %s TO nextkin_maintenance', p_table);
  EXECUTE format('GRANT SELECT ON %s TO nextkin_readonly', p_table);
END
$$;

-- Global reference tables (the KB, plans, templates): everyone reads; only staff roles write.
-- Writes happen through admin sessions (app.role) on the app role.
CREATE FUNCTION app.apply_reference_rls(p_table regclass, p_public_filter text DEFAULT 'true')
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', p_table);
  EXECUTE format($p$CREATE POLICY reference_read ON %s FOR SELECT TO nextkin_app, nextkin_readonly, nextkin_maintenance
                   USING ((%s) OR app.current_app_role() IN ('admin', 'curator', 'support', 'system'))$p$,
                 p_table, p_public_filter);
  EXECUTE format($p$CREATE POLICY staff_write ON %s TO nextkin_app
                   USING (app.current_app_role() IN ('admin', 'curator'))
                   WITH CHECK (app.current_app_role() IN ('admin', 'curator'))$p$, p_table);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO nextkin_app', p_table);
  EXECUTE format('GRANT SELECT ON %s TO nextkin_readonly, nextkin_maintenance', p_table);
END
$$;

-- The helpers are part of the schema contract, not callable by the runtime roles.
REVOKE ALL ON FUNCTION app.apply_owner_rls(regclass, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.apply_reference_rls(regclass, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.uuid_v7(), app.current_user_id(), app.current_app_role(), app.is_org_member(uuid)
  TO nextkin_app, nextkin_maintenance, nextkin_readonly;
