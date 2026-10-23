#!/bin/sh
# Database roles (ImBackendImplementationPlan P1-05, ground rule G7). Runs once, on first start of
# an empty data volume. The same statements bootstrap Aurora from aws/setup (X-05).
#
#   nextkin_owner        owns the schema; only the migrate task logs in as it
#   nextkin_app          web and worker. NOT the owner and NOBYPASSRLS, so row-level security
#                        always applies and the app cannot switch it off
#   nextkin_maintenance  purge and sweep jobs, granted table by table
#   nextkin_readonly     read-only paths (support lookups, analytics)
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v owner_pw="$NEXTKIN_OWNER_PASSWORD" \
  -v app_pw="$NEXTKIN_APP_PASSWORD" \
  -v maintenance_pw="$NEXTKIN_MAINTENANCE_PASSWORD" \
  -v readonly_pw="$NEXTKIN_READONLY_PASSWORD" \
  -v db="$POSTGRES_DB" <<'SQL'
CREATE ROLE nextkin_owner       LOGIN PASSWORD :'owner_pw'       NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE nextkin_app         LOGIN PASSWORD :'app_pw'         NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
CREATE ROLE nextkin_maintenance LOGIN PASSWORD :'maintenance_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
CREATE ROLE nextkin_readonly    LOGIN PASSWORD :'readonly_pw'    NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;

-- Migrations (run as the owner) create the `app` schema and the migration ledger, so the owner may
-- create schemas in this database. Nobody else can create objects anywhere.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO nextkin_owner, nextkin_app, nextkin_maintenance, nextkin_readonly;
GRANT CREATE ON DATABASE :"db" TO nextkin_owner;

-- Runtime limits for the roles that serve traffic. A runaway query or an abandoned transaction
-- cannot hold a connection or a lock for long (R-12).
ALTER ROLE nextkin_app SET statement_timeout = '5s';
ALTER ROLE nextkin_app SET lock_timeout = '2s';
ALTER ROLE nextkin_app SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE nextkin_maintenance SET statement_timeout = '60s';
ALTER ROLE nextkin_maintenance SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE nextkin_readonly SET statement_timeout = '15s';
ALTER ROLE nextkin_readonly SET default_transaction_read_only = on;

ALTER ROLE nextkin_owner       SET search_path = app, public;
ALTER ROLE nextkin_app         SET search_path = app, public;
ALTER ROLE nextkin_maintenance SET search_path = app, public;
ALTER ROLE nextkin_readonly    SET search_path = app, public;

-- Extension allowlist: only what Aurora PostgreSQL 17 also offers. [verify each on Aurora 17]
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
SQL
