import { createHash } from 'node:crypto';

import type { Database } from '../db/database';
import type { Logger } from '../observability/logger';
import { createFixtureProvider } from './providers/fixture';
import { createRecordedProvider } from './providers/recorded';
import type { JobProvider, ProviderName } from './types';

/**
 * Which providers a search fans out to (ImBackendImplementationPlan P11-01; V2 §9.6). The adapter
 * (`JOBS_ADAPTER`) decides which providers can exist in this process; `job_provider_configs`
 * decides which are enabled, in what order and with what daily quota, so adding, reordering or
 * disabling a provider is a settings change. Read through the system role and cached for 30 s,
 * like the AI routing table. The version names the enabled set, and search results are cached
 * under it, so a provider switched off drops out of every result at once.
 */

export type JobsAdapter = 'fixture' | 'recorded' | 'providers';

export interface ProviderSetting {
  provider: ProviderName;
  priority: number;
  dailyCalls?: number;
}

export interface ActiveProviders {
  providers: { provider: JobProvider; setting: ProviderSetting }[];
  /** Changes whenever the enabled set, its order or a quota changes. */
  version: string;
}

export interface ProviderRegistry {
  active(): Promise<ActiveProviders>;
  /** Drops the cached settings (tests, and an admin save in P12). */
  refresh(): void;
}

/** The providers each adapter can build. Real Adzuna and JSearch adapters arrive with X-12. */
export function buildProviders(adapter: JobsAdapter): Partial<Record<ProviderName, JobProvider>> {
  if (adapter === 'fixture') return { fixture: createFixtureProvider() };
  if (adapter === 'recorded') return { adzuna: createRecordedProvider('adzuna'), jsearch: createRecordedProvider('jsearch') };
  return {};
}

export function createProviderRegistry(deps: { db: Database; providers: Partial<Record<ProviderName, JobProvider>>; log: Logger; ttlMs?: number }): ProviderRegistry {
  const ttlMs = deps.ttlMs ?? 30_000;
  let cached: { at: number; value: ActiveProviders } | null = null;

  async function load(): Promise<ActiveProviders> {
    const rows = await deps.db.withSystem('jobs: read provider settings', (tx) =>
      tx.selectFrom('job_provider_configs').select(['provider', 'enabled', 'priority', 'limits']).where('enabled', '=', true).orderBy('priority').orderBy('provider').execute(),
    );
    const providers: ActiveProviders['providers'] = [];
    for (const row of rows) {
      const provider = deps.providers[row.provider as ProviderName];
      if (!provider) {
        deps.log.warn({ event: 'jobs.provider_unavailable', provider: row.provider }, 'an enabled job provider has no adapter in this process');
        continue;
      }
      const limits = (row.limits ?? {}) as { dailyCalls?: number };
      providers.push({ provider, setting: { provider: provider.name, priority: row.priority, ...(typeof limits.dailyCalls === 'number' ? { dailyCalls: limits.dailyCalls } : {}) } });
    }
    const version = createHash('sha256')
      .update(JSON.stringify(providers.map((p) => p.setting)))
      .digest('hex')
      .slice(0, 12);
    return { providers, version };
  }

  return {
    async active() {
      if (cached && Date.now() - cached.at < ttlMs) return cached.value;
      const value = await load();
      cached = { at: Date.now(), value };
      return value;
    },
    refresh() {
      cached = null;
    },
  };
}
