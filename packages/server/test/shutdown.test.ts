import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { ApiEnv } from '../src/http/env';
import { requestContext, waitForDrain, type InFlight } from '../src/http/middleware/context';
import { createLogger } from '../src/observability/logger';

/** Graceful shutdown (ImBackendImplementationPlan P3-10): SIGTERM lets running requests finish. */
describe('drain on shutdown', () => {
  it('waits for an in-flight request to finish, and the request still succeeds', async () => {
    const inFlight: InFlight = { count: 0 };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const app = new Hono<ApiEnv>();
    app.use(requestContext({ log: createLogger('silent', 'test'), inFlight }));
    app.get('/slow', async (c) => {
      await gate;
      return c.text('done');
    });

    const response = app.request('/slow');
    await new Promise((r) => setTimeout(r, 10));
    expect(inFlight.count).toBe(1);

    let drained = false;
    const drain = waitForDrain(inFlight, 2_000, 5).then((left) => {
      drained = true;
      return left;
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(drained).toBe(false); // still waiting: the request has not finished

    release();
    expect(await drain).toBe(0);
    expect(await (await response).text()).toBe('done');
  });

  it('gives up at the deadline and reports what was still running', async () => {
    expect(await waitForDrain({ count: 2 }, 40, 5)).toBe(2);
  });
});
