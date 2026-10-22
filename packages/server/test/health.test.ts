import { describe, expect, it } from 'vitest';
import type { DependencyChecks } from '../src/health/checks';
import { createApi } from '../src/http/app';

const ok = async () => {};
const healthy: DependencyChecks = { database: ok, valkey: ok, storage: ok, queue: ok };

describe('health routes', () => {
  it('shallow health answers 200 without touching any dependency', async () => {
    let touched = false;
    const spy = async () => {
      touched = true;
    };
    const app = createApi({ checks: { database: spy, valkey: spy, storage: spy, queue: spy } });
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(touched).toBe(false);
  });

  it('deep health reports every dependency when all are up', async () => {
    const res = await createApi({ checks: healthy }).request('/api/v1/health/deep');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; dependencies: { name: string; ok: boolean }[] };
    expect(body.status).toBe('ok');
    expect(body.dependencies.map((d) => d.name).sort()).toEqual(['database', 'queue', 'storage', 'valkey']);
  });

  it('a stopped Valkey degrades deep health while shallow health stays 200', async () => {
    const app = createApi({
      checks: {
        ...healthy,
        valkey: async () => {
          throw new Error('connect ECONNREFUSED 127.0.0.1:6379');
        },
      },
    });
    const deep = await app.request('/api/v1/health/deep');
    expect(deep.status).toBe(503);
    const body = (await deep.json()) as { status: string; dependencies: { name: string; ok: boolean; error?: string }[] };
    expect(body.status).toBe('degraded');
    expect(body.dependencies.find((d) => d.name === 'valkey')).toMatchObject({ ok: false });
    expect((await app.request('/api/v1/health')).status).toBe(200);
  });

  it('a hung dependency times out instead of hanging the report', async () => {
    const app = createApi({ checks: { ...healthy, queue: () => new Promise(() => {}) } });
    const res = await app.request('/api/v1/health/deep');
    const body = (await res.json()) as { dependencies: { name: string; error?: string }[] };
    expect(body.dependencies.find((d) => d.name === 'queue')?.error).toMatch(/timed out/);
  }, 5_000);

  it('unknown routes are 404', async () => {
    expect((await createApi({ checks: healthy }).request('/api/v1/nope')).status).toBe(404);
  });
});
