import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The repository root: the Docker build context for every image. */
export const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

/** Every image and library version comes from docker/versions.env (CLAUDE.md, backend rule 4). */
function readVersions(): Record<string, string> {
  const text = readFileSync(join(REPO_ROOT, 'docker', 'versions.env'), 'utf8');
  const entries = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)] as const);
  return Object.fromEntries(entries);
}

const versions = readVersions();

export function pinned(key: string): string {
  const value = versions[key];
  if (!value) throw new Error(`docker/versions.env has no ${key}`);
  return value;
}

/** The roles bootstrap script the local Postgres runs on first start; Aurora runs the same one. */
export const ROLES_SCRIPT = readFileSync(
  join(REPO_ROOT, 'docker', 'postgres', 'init', '01-roles.sh'),
  'utf8',
);

/** The demo's names. One environment, one account (toreview §133). */
export const DEMO = {
  stack: 'NextkinDemo',
  database: 'nextkin',
  masterUser: 'postgres',
  // Cloud Map names inside the VPC: <name>.nextkin.internal.
  namespace: 'nextkin.internal',
  queuePrefix: 'nextkin-demo-',
  queues: ['generation-priority', 'generation-standard', 'maintenance'],
  secretPrefix: 'nextkin-demo',
} as const;
