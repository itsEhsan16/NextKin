// One command from a clean clone to a running backend (ImBackendImplementationPlan P1-08, M0-25):
// stack up → stack:init → migrate → seed → web + worker, with prefixed output.
// Ctrl+C stops web and worker; the stack keeps running (`pnpm stack:down` stops it).
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const isWindows = process.platform === 'win32';

if (!existsSync(join(root, '.env'))) {
  copyFileSync(join(root, '.env.example'), join(root, '.env'));
  console.log('Created .env from .env.example');
}
process.loadEnvFile(join(root, '.env'));

function step(label, command, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: isWindows });
  if (result.status !== 0) {
    console.error(`✖ ${label} failed`);
    process.exit(result.status ?? 1);
  }
}

step('stack up', 'node', ['scripts/stack.mjs', 'up']);
step('stack init', 'pnpm', ['stack:init']);
step('migrate', 'pnpm', ['migrate']);
step('seed', 'pnpm', ['seed']);

const children = [
  ['web', ['--filter', '@nextkin/web', 'dev']],
  ['worker', ['--filter', '@nextkin/server', 'worker']],
].map(([name, args]) => {
  const child = spawn('pnpm', args, { cwd: root, env: process.env, shell: isWindows });
  const prefix = (stream, out) =>
    stream.on('data', (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/)) if (line) out.write(`[${name}] ${line}\n`);
    });
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`[${name}] exited with ${code}`);
    shutdown(code ?? 1);
  });
  return child;
});

let stopping = false;
function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill();
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
