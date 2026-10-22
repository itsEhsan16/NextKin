import { createHash } from 'node:crypto';

import type { KvCache } from '../cache/kv';

/**
 * `SecretsPort` (ImBackendImplementationPlan P12-05; spec §7.17, §9.7). Provider keys entered in the
 * admin portal are write-only: `put` stores a value and returns a reference (an ARN in the cloud),
 * the database keeps only that reference, and nothing on the API can read a value back. The
 * application reads by reference, in process, when it calls the provider.
 *
 * Locally the values sit in Valkey under the reference (a stand-in; L3 refuses it outside local
 * and test). AWS Secrets Manager, one KMS-encrypted secret per provider, arrives at X-05.
 */
export interface SecretsPort {
  put(name: string, value: string): Promise<string>;
  /** Server-side use only (provider calls). No route returns it. */
  read(ref: string): Promise<string | null>;
}

export function createLocalSecrets(kv: KvCache): SecretsPort {
  return {
    async put(name, value) {
      const ref = `local-secret:${name}:${createHash('sha256').update(`${name}:${Date.now()}`).digest('hex').slice(0, 12)}`;
      await kv.set(ref, value, 365 * 24 * 3600);
      return ref;
    },
    read: (ref) => kv.get<string>(ref),
  };
}
