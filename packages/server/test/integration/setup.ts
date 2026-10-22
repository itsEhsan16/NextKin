import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Integration tests run against the compose stack. Locally its addresses come from the root .env;
// in CI the workflow sets them in the environment, and an already-set variable wins.
const rootEnv = join(import.meta.dirname, '../../../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
