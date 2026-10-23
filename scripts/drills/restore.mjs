// The restore drill (ImBackendImplementationPlan P13-04; the local twin of M5-15).
//
//   node scripts/drills/restore.mjs [--volume 5000]
//
// 1. Seeds synthetic volume users (L4: synthetic data only), unless --volume 0.
// 2. Dumps the database with pg_dump (custom format) inside the postgres container.
// 3. Restores it into a fresh database, nextkin_restore, with pg_restore -j 4.
// 4. Repoints the app at the restored database (the app and maintenance roles, over RLS) and checks
//    the row counts match the source.
// Prints each step's time and the total; the dated result goes in aws/drills/.
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const volumeAt = args.indexOf('--volume');
const volume = volumeAt >= 0 ? Number(args[volumeAt + 1]) : 5000;
const compose = 'docker compose --env-file docker/versions.env';
const psql = (db, sql) => execSync(`${compose} exec -T postgres psql -U postgres -d ${db} -At -c "${sql}"`).toString().trim();
const step = (name, fn) => {
  const started = Date.now();
  const out = fn();
  const ms = Date.now() - started;
  console.log(`${name.padEnd(34)} ${(ms / 1000).toFixed(1)} s`);
  return { ms, out };
};

const times = {};
if (volume > 0) times.seed = step(`seed ${volume} volume users`, () => execSync(`pnpm seed -- --volume ${volume}`, { stdio: 'ignore' })).ms;

const counts = (db) => psql(db, "select (select count(*) from app.users)||','||(select count(*) from app.resumes)||','||(select count(*) from app.resume_versions)||','||(select count(*) from app.generations)");
const source = counts('nextkin');
const size = psql('nextkin', "select pg_size_pretty(pg_database_size('nextkin'))");

times.dump = step('pg_dump -Fc', () => execSync(`${compose} exec -T postgres pg_dump -U postgres -Fc -f /tmp/nextkin.dump nextkin`)).ms;
const dumpSize = execSync(`${compose} exec -T postgres sh -c "du -h /tmp/nextkin.dump | cut -f1"`).toString().trim();
psql('postgres', 'DROP DATABASE IF EXISTS nextkin_restore');
times.restore = step('createdb + pg_restore -j 4', () => {
  psql('postgres', 'CREATE DATABASE nextkin_restore OWNER nextkin_owner');
  execSync(`${compose} exec -T postgres pg_restore -U postgres -j 4 --exit-on-error -d nextkin_restore /tmp/nextkin.dump`);
}).ms;
// Roles are cluster-wide, so the grants come back with the dump; the app connects as before.
times.repoint = step('repoint the app and verify', () => {
  psql('postgres', 'GRANT CONNECT ON DATABASE nextkin_restore TO nextkin_app, nextkin_maintenance, nextkin_readonly');
  const restored = counts('nextkin_restore');
  if (restored !== source) throw new Error(`row counts differ: source ${source}, restored ${restored}`);
  // The app role, under RLS, reads the restored database.
  execSync(`${compose} exec -T postgres psql "postgres://nextkin_app:app_local@127.0.0.1:5432/nextkin_restore" -At -c "select count(*) from app.plans"`);
  return restored;
}).ms;

const total = Object.values(times).reduce((a, b) => a + b, 0) - (times.seed ?? 0);
console.log(`\nsource ${size}, dump ${dumpSize}; rows users,resumes,versions,generations = ${source}`);
console.log(`restore path (dump + restore + repoint): ${(total / 1000).toFixed(1)} s`);
psql('postgres', 'DROP DATABASE nextkin_restore');
execSync(`${compose} exec -T postgres rm -f /tmp/nextkin.dump`);
