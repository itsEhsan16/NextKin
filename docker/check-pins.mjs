// Fails when an image is unpinned or a *_SHA256* checksum pin is malformed (ImBackendImplementationPlan
// L6, P0-02).
// Checks docker/versions.env, and docker-compose.yml and the workflows once they reference images.
// Run: pnpm check:pins
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const problems = [];

const versions = readFileSync(join(root, 'docker/versions.env'), 'utf8');
for (const [i, line] of versions.split('\n').entries()) {
  // A checksum pin is a full SHA-256: exactly 64 lowercase hex characters.
  const sum = line.match(/^(\w*_SHA256\w*)=(.*)$/);
  if (sum && !/^[0-9a-f]{64}$/.test(sum[2].trim())) {
    problems.push(`docker/versions.env:${i + 1} ${sum[1]} is not a 64-hex SHA-256`);
  }
  const m = line.match(/^(\w+_IMAGE)=(.*)$/);
  if (!m) continue;
  const [, key, ref] = m;
  const tag = ref.includes(':') ? ref.slice(ref.lastIndexOf(':') + 1) : '';
  if (!tag || tag === 'latest' || tag.startsWith('latest-')) {
    problems.push(`docker/versions.env:${i + 1} ${key} is not pinned (${ref})`);
  }
}

const others = ['docker-compose.yml'];
const workflows = join(root, '.github/workflows');
if (existsSync(workflows)) {
  for (const f of readdirSync(workflows)) others.push(join('.github/workflows', f));
}
for (const rel of others) {
  const path = join(root, rel);
  if (!existsSync(path)) continue;
  for (const [i, line] of readFileSync(path, 'utf8').split('\n').entries()) {
    if (/image:\s*\S+:latest\b/.test(line) || /docker:\/\/\S+:latest\b/.test(line)) {
      problems.push(`${rel}:${i + 1} uses a latest tag`);
    }
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('All images are pinned.');
