// Local security scans (ImBackendImplementationPlan P13-01), run in pinned containers so nothing is
// installed on the host:
//
//   pnpm scan:secrets   gitleaks over the git history and the working tree (.gitleaks.toml)
//   pnpm scan:deps      OSV-Scanner over pnpm-lock.yaml
//
// Images come from docker/versions.env (rule 4). Exit code is the scanner's: non-zero means findings.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pins = Object.fromEntries(
  readFileSync(join(root, 'docker/versions.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => l.split('=', 2)),
);
// Docker Desktop on Windows wants a drive path; Git Bash would otherwise rewrite /repo.
const mount = `${root.replace(/\\/g, '/')}:/repo`;
const env = { ...process.env, MSYS_NO_PATHCONV: '1' };
const docker = (args) => spawnSync('docker', ['run', '--rm', '-v', mount, ...args], { stdio: 'inherit', env }).status ?? 1;

const which = process.argv[2];
let status = 0;
if (which === 'secrets') {
  for (const mode of ['git', 'dir']) {
    console.log(`\ngitleaks ${mode}`);
    status ||= docker([pins.GITLEAKS_IMAGE, mode, '/repo', '-c', '/repo/.gitleaks.toml', '--no-banner', '--redact']);
  }
} else if (which === 'deps') {
  status = docker([pins.OSV_SCANNER_IMAGE, 'scan', 'source', '--lockfile', '/repo/pnpm-lock.yaml']);
} else {
  console.error('usage: node scripts/scan.mjs secrets|deps');
  status = 2;
}
process.exit(status);
