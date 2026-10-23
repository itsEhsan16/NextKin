import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Database } from '../db/database';
import { createApi, openApiDocument, type ApiDeps } from '../http/app';

/**
 * Writes packages/server/openapi.json from the route definitions (ImBackendImplementationPlan
 * P3-08). The file is checked in: `--check` fails when it is out of date, and CI also diffs it
 * against main with oasdiff, so a breaking change cannot land without a version bump.
 */
const noop = async () => {};
// The document only needs the route definitions; no route is called, so no database is opened.
// Identity is a stub for the same reason: its routes are registered, never called.
const identity = { apiPublicUrl: 'http://localhost:3000', mobileRedirectAllowlist: [] } as unknown as NonNullable<ApiDeps['identity']>;
// Storage likewise: the upload routes are registered so they are documented, never called.
const files = { uploads: { storage: {} }, teaser: {} } as unknown as NonNullable<ApiDeps['files']>;
const app = createApi({ checks: { database: noop, valkey: noop, storage: noop, queue: noop }, db: {} as Database, identity, files });
const output = `${JSON.stringify(openApiDocument(app), null, 2)}\n`;
const target = join(import.meta.dirname, '../../openapi.json');

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    // missing counts as stale
  }
  if (current !== output) {
    console.error('openapi.json is out of date. Run `pnpm --filter @nextkin/server openapi` and commit it.');
    process.exit(1);
  }
  console.log('openapi.json is up to date.');
} else {
  writeFileSync(target, output);
  console.log(`wrote ${target}`);
}
