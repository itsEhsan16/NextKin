import { describe, expect, it } from 'vitest';

import type { Identity } from '../src/db/database';
import type { DependencyChecks } from '../src/health/checks';
import { createApi } from '../src/http/app';

/**
 * The admin portal on its own host (toreview §249): admin.app.nextkin.ai shares the API, so a
 * signed-in write from it must pass the cookie CSRF check, while any other site still fails.
 */
const ok = async () => {};
const checks: DependencyChecks = { database: ok, valkey: ok, storage: ok, queue: ok };
const identity = { userId: 'u1', role: 'user' } as unknown as Identity;

const api = (adminOrigin?: string) =>
  createApi({
    checks,
    config: {
      appEnv: 'test',
      appOrigin: 'https://app.example',
      cursorSecret: 'test-cursor-secret-not-for-real-use-000000',
      ...(adminOrigin ? { adminOrigin } : {}),
    },
    authenticate: async () => ({ identity, via: 'cookie' }),
  });

const post = (app: ReturnType<typeof api>, origin: string) =>
  app.request('/api/v1/nothing-here', { method: 'POST', headers: { origin } });

describe('the admin origin', () => {
  it('may write with a cookie session once it is configured', async () => {
    const app = api('https://admin.example');
    expect((await post(app, 'https://admin.example')).status).not.toBe(403);
    expect((await post(app, 'https://app.example')).status).not.toBe(403);
    expect((await post(app, 'https://evil.example')).status).toBe(403);
  });

  it('is refused while no admin origin is set', async () => {
    expect((await post(api(), 'https://admin.example')).status).toBe(403);
  });
});
