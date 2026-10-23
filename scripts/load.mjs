// k6 baselines (ImBackendImplementationPlan P13-03) in the pinned k6 container (docker/versions.env).
//
//   pnpm load:users 30          prepare the accounts and tokens first (valid 60 minutes)
//   pnpm load crud|generations|sse [-- -e VUS=20 -e DURATION=2m ...]
//
// The container reaches the API on the host at host.docker.internal:3000 (BASE_URL overrides).
// The end-of-run summary is written to tests/load/results/ (gitignored); copy the numbers into the
// dated drill record in aws/drills/.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pins = Object.fromEntries(
  readFileSync(join(root, 'docker/versions.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => l.split('=', 2)),
);
const [script, ...rest] = process.argv.slice(2).filter((a) => a !== '--');
if (!['crud', 'generations', 'sse'].includes(script)) {
  console.error('usage: pnpm load crud|generations|sse [-e NAME=value ...]');
  process.exit(2);
}
mkdirSync(join(root, 'tests/load/results'), { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const args = [
  'run', '--rm',
  '-v', `${root.replace(/\\/g, '/')}:/repo`,
  '-w', '/repo/tests/load',
  '--add-host', 'host.docker.internal:host-gateway',
  '-e', `BASE_URL=${process.env.BASE_URL ?? 'http://host.docker.internal:3000'}`,
  pins.K6_IMAGE,
  'run', '--summary-export', `results/${script}-${stamp}.json`, ...rest, `${script}.js`,
];
const status = spawnSync('docker', args, { stdio: 'inherit', env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).status ?? 1;
process.exit(status);
