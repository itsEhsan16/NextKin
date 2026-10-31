// Wraps `docker compose` for the local stack (ImBackendImplementationPlan P1-08).
//   node scripts/stack.mjs up [--profile scan ...]   start (core by default) and wait for health
//   node scripts/stack.mjs down                      stop, keep data
//   node scripts/stack.mjs reset                     stop and delete every volume
//   node scripts/stack.mjs logs [service]            follow logs
// Image versions always come from docker/versions.env; .env is added when it exists.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const [command = 'up', ...rest] = process.argv.slice(2).filter((a) => a !== '--');

const envFiles = ['--env-file', 'docker/versions.env'];
if (existsSync(join(root, '.env'))) envFiles.push('--env-file', '.env');

const hasProfile = rest.includes('--profile');
const profiles = hasProfile ? [] : ['--profile', 'core'];
// down/reset/logs act on every profile, so nothing started under `scan` or `app` is left behind.
const allProfiles = ['core', 'scan', 'auth', 'obs', 'pay', 'app', 'latex', 'links'].flatMap((p) => ['--profile', p]);

// The LaTeX and link reader services' bearer tokens (compose secrets). Compose needs the files to exist,
// so a random one is written the first time; it never leaves the laptop (gitignored, dockerignored).
for (const tokenFile of [join(root, 'docker/latex/dev.token'), join(root, 'docker/link-reader/dev.token')]) {
  mkdirSync(join(tokenFile, '..'), { recursive: true });
  if (!existsSync(tokenFile)) writeFileSync(tokenFile, `${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
}

const commands = {
  up: [...profiles, ...rest, 'up', '-d', '--wait', '--wait-timeout', '180'],
  down: [...allProfiles, 'down'],
  reset: [...allProfiles, 'down', '--volumes', '--remove-orphans'],
  logs: [...allProfiles, 'logs', '-f', ...rest],
  ps: [...allProfiles, 'ps'],
};

const args = commands[command];
if (!args) {
  console.error(`Unknown command "${command}". Use: ${Object.keys(commands).join(', ')}`);
  process.exit(2);
}

const result = spawnSync('docker', ['compose', ...envFiles, ...args], { cwd: root, stdio: 'inherit' });
if (result.error) {
  console.error(`Could not run docker: ${result.error.message}. Is Docker Desktop running?`);
  process.exit(1);
}
process.exit(result.status ?? 1);
