import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { warmupSources } from '../export/latex/warmupSources';

/**
 * Writes the `latex` image's warm-up documents into the directory given as the first argument
 * (docker/Dockerfile runs it at build time; toreview §111). `node dist/latex-warmup.mjs <dir>`.
 */

const dir = process.argv[2];
if (!dir) {
  console.error('usage: latex-warmup <output dir>');
  process.exit(2);
}
mkdirSync(dir, { recursive: true });
for (const { name, tex } of warmupSources()) writeFileSync(join(dir, name), tex, 'utf8');
console.log(`wrote ${warmupSources().length} warm-up sources to ${dir}`);
