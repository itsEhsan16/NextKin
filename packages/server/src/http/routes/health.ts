import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { runChecks, type DependencyChecks } from '../../health/checks';
import { CAPABILITIES, NO_SIGNAL, type DegradedSignal } from '../../health/degraded';
import type { ApiEnv } from '../env';
import { checked } from '../respond';

/**
 * Liveness and the dependency report (R-08). Shallow health touches nothing, so a shared outage
 * never drains every task from the load balancer. Deep health feeds alarms and the degraded-mode
 * banner, and must never be configured as a load-balancer check.
 */

const shallowSchema = z.object({ status: z.literal('ok') });
const deepSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  dependencies: z.array(
    z.object({
      name: z.enum(['database', 'valkey', 'storage', 'queue']),
      ok: z.boolean(),
      latencyMs: z.number(),
      error: z.string().optional(),
    }),
  ),
});

const shallow = createRoute({
  method: 'get',
  path: '/health',
  tags: ['health'],
  summary: 'Liveness: the process is serving.',
  responses: { 200: { description: 'Alive.', content: { 'application/json': { schema: shallowSchema } } } },
});

const deep = createRoute({
  method: 'get',
  path: '/health/deep',
  tags: ['health'],
  summary: 'Dependency report for alarms and the degraded banner. Never a load-balancer check.',
  responses: {
    200: { description: 'Every dependency is reachable.', content: { 'application/json': { schema: deepSchema } } },
    503: { description: 'At least one dependency is down.', content: { 'application/json': { schema: deepSchema } } },
  },
});

const featuresSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  capabilities: z.array(z.object({ capability: z.enum(CAPABILITIES), degraded: z.boolean(), since: z.string().optional(), message: z.string().optional() })),
});

const features = createRoute({
  method: 'get',
  path: '/health/features',
  tags: ['health'],
  summary: 'Which capabilities are running degraded (R-09): what the apps’ banner says. Public, no PII.',
  responses: { 200: { description: 'The capabilities.', content: { 'application/json': { schema: featuresSchema } } } },
});

export function healthRoutes(checks: DependencyChecks, signal: DegradedSignal = NO_SIGNAL): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  app.openapi(features, async (c) => {
    const capabilities = await signal.read();
    c.header('Cache-Control', 'no-store');
    return c.json(checked(featuresSchema, { status: capabilities.some((x) => x.degraded) ? 'degraded' : 'ok', capabilities }), 200);
  });
  app.openapi(shallow, (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json(checked(shallowSchema, { status: 'ok' }), 200);
  });
  app.openapi(deep, async (c) => {
    const dependencies = await runChecks(checks);
    const degraded = dependencies.some((d) => !d.ok);
    c.header('Cache-Control', 'no-store');
    const body = checked(deepSchema, { status: degraded ? 'degraded' : 'ok', dependencies });
    return degraded ? c.json(body, 503) : c.json(body, 200);
  });
  return app;
}
