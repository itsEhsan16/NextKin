import { describe, expect, it } from 'vitest';

import type { DependencyChecks } from '../src/health/checks';
import { createApi } from '../src/http/app';
import { createStaticFlags } from '../src/flags/flags';

const ok = async () => {};
const checks: DependencyChecks = { database: ok, valkey: ok, storage: ok, queue: ok };

describe('GET /app/version (toreview §245)', () => {
  it('answers the floor and the newest store version for the platform, signed out', async () => {
    const flags = createStaticFlags({
      'clients.minimum_version': { android: '1.0.0', ios: '1.1.0' },
      'clients.latest_version': { android: '1.2.0' },
    });
    const app = createApi({ checks, flags });
    const res = await app.request('/api/v1/app/version?platform=android');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ minimum: '1.0.0', latest: '1.2.0' });
    expect(res.headers.get('cache-control')).toBe('no-store');

    const ios = await app.request('/api/v1/app/version?platform=ios');
    expect(await ios.json()).toEqual({ minimum: '1.1.0', latest: null });
  });

  it('says nothing is set when no setting exists', async () => {
    const res = await createApi({ checks }).request('/api/v1/app/version?platform=ios');
    expect(await res.json()).toEqual({ minimum: null, latest: null });
  });

  it('refuses an unknown platform', async () => {
    const res = await createApi({ checks }).request('/api/v1/app/version?platform=web');
    expect(res.status).toBe(400);
  });
});
