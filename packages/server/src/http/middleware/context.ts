import { randomBytes } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import type { ApiEnv } from '../env';
import type { Logger } from '../../observability/logger';
import { activeTraceId, tracer, withIncomingContext } from '../../observability/tracing';
import { SpanStatusCode } from '@opentelemetry/api';

/**
 * The first link in the chain (ImBackendImplementationPlan P3-03, P3-04, P3-09, P3-10):
 * request id, trace span, timing, the access log line, client identification, and an in-flight
 * count so shutdown can drain. Runs before anything that can fail, so every response carries
 * `X-Request-Id` and every failure is logged with it.
 */

const REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

export interface InFlight {
  count: number;
}

/**
 * Resolves once no request is in flight, or when the deadline passes (P3-10). Shutdown calls this
 * before closing pools, so a SIGTERM lets running requests finish instead of cutting them off.
 * Returns how many were still running at the deadline.
 */
export async function waitForDrain(inFlight: InFlight, deadlineMs: number, pollMs = 25): Promise<number> {
  const deadline = Date.now() + deadlineMs;
  while (inFlight.count > 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, pollMs));
  return inFlight.count;
}

export interface ContextOptions {
  log: Logger;
  /** Header that carries the client IP from a trusted proxy. Never X-Forwarded-For in the cloud. */
  trustedIpHeader?: string;
  inFlight: InFlight;
}

/** Reads the client IP from the configured trusted header only (spec §9.4.1). */
export function clientIpFrom(headers: Headers, trustedIpHeader?: string): string {
  if (!trustedIpHeader) return 'unknown';
  const raw = headers.get(trustedIpHeader);
  if (!raw) return 'unknown';
  const first = raw.split(',')[0]!.trim();
  // CloudFront-Viewer-Address is "ip:port" (IPv6 in brackets or bare with colons).
  if (trustedIpHeader.toLowerCase() === 'cloudfront-viewer-address') {
    const lastColon = first.lastIndexOf(':');
    return (lastColon > 0 ? first.slice(0, lastColon) : first).replace(/^\[|\]$/g, '') || 'unknown';
  }
  return first || 'unknown';
}

export function requestContext(options: ContextOptions): MiddlewareHandler<ApiEnv> {
  return (c, next) =>
    withIncomingContext(c.req.raw.headers, () =>
      tracer.startActiveSpan(`HTTP ${c.req.method}`, async (span) => {
        const started = performance.now();
        const inbound = c.req.header('x-request-id');
        const requestId = inbound && REQUEST_ID.test(inbound) ? inbound : (activeTraceId() ?? randomBytes(16).toString('hex'));
        const client = c.req.header('x-client') ?? null;
        const clientVersion = c.req.header('x-client-version') ?? null;

        c.set('requestId', requestId);
        c.set('clientIp', clientIpFrom(c.req.raw.headers, options.trustedIpHeader));
        c.set('client', client);
        c.set('clientVersion', clientVersion);
        c.set('auth', null);
        c.set('log', options.log.child({ requestId }));
        span.setAttributes({ 'http.request.method': c.req.method, 'nextkin.request_id': requestId });

        options.inFlight.count += 1;
        try {
          await next();
        } finally {
          options.inFlight.count -= 1;
          const status = c.res.status;
          const route = c.req.routePath;
          span.setAttributes({ 'http.route': route, 'http.response.status_code': status });
          if (status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
          span.updateName(`HTTP ${c.req.method} ${route}`);
          span.end();
          c.res.headers.set('X-Request-Id', requestId);
          const fields = {
            event: 'http.request',
            method: c.req.method,
            route,
            status,
            durationMs: Math.round(performance.now() - started),
            client,
            clientVersion,
            userId: c.get('auth')?.identity.userId,
          };
          if (status >= 500) c.get('log').error(fields, 'request failed');
          else c.get('log').info(fields, 'request');
        }
      }),
    );
}

/** Defaults every API response should carry. Authenticated responses are never cached anywhere. */
export function securityHeaders(): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    await next();
    c.res.headers.set('X-Content-Type-Options', 'nosniff');
    c.res.headers.set('Referrer-Policy', 'no-referrer');
    c.res.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    if (!c.res.headers.has('Cache-Control')) {
      c.res.headers.set('Cache-Control', c.get('auth') ? 'private, no-store' : 'no-store');
    }
  };
}
