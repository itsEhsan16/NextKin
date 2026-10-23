import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';
import { createDependencyChecks } from '../../src/health/checks';
import { createApi } from '../../src/http/app';

/**
 * The deep health check against the real local stack (ImBackendImplementationPlan P1-09): with
 * `pnpm stack:up` and `pnpm stack:init` done, every dependency reports ok.
 */
describe('deep health against the compose stack', () => {
  it('reports database, valkey, storage and queue as ok', async () => {
    const app = createApi({ checks: createDependencyChecks(loadConfig()) });
    const res = await app.request('/api/v1/health/deep');
    const body = (await res.json()) as { status: string; dependencies: { name: string; ok: boolean; error?: string }[] };
    expect(body.dependencies.filter((d) => !d.ok)).toEqual([]);
    expect(res.status).toBe(200);
  });
});
