import type { OpenAPIHono } from '@hono/zod-openapi';
import Valkey from 'iovalkey';
import { buildAiGateway, isLiveRoute } from '../ai/build';
import { createModelBrain, createStandInBrain, dbPrompts } from '../assistant/brain';
import { buildIdentity } from '../auth/build';
import { createSmtpEmail } from '../email/email';
import { buildPaymentProvider, type WebhookDelivery } from '../payments/build';
import { ingestWebhook } from '../services/billingWebhooks';
import { createLocalSecrets } from '../secrets/secrets';
import { createDegradedSignal } from '../health/degraded';
import { createValkeyKv } from '../cache/kv';
import { egressHostsFor, setEgressAllowlist } from '../net/egress';
import { createValkeyIdempotencyStore, createValkeyRateLimiter } from '../cache/valkeyStores';
import { createBreaker } from '../jobs/breaker';
import { buildProviders, createProviderRegistry } from '../jobs/registry';
import { loadConfig } from '../config';
import { buildFileDeps, buildStorage } from '../storage/build';
import { createDatabase } from '../db/database';
import { createValkeyPublisher } from '../pipeline/events';
import { createGenerationHub } from '../pipeline/hub';
import { createFlags } from '../flags/flags';
import { createDependencyChecks } from '../health/checks';
import { createLogger } from '../observability/logger';
import { startTracing } from '../observability/tracing';
import { createApi } from './app';
import type { ApiEnv } from './env';
import { waitForDrain, type InFlight } from './middleware/context';

/**
 * One API per process, built on first request. Next's dev server re-evaluates route modules on
 * edit, so the instance lives on globalThis and is not rebuilt (no leaked pools per hot reload).
 *
 * Graceful shutdown (P3-10): on SIGTERM, wait for in-flight requests (up to SHUTDOWN_DRAIN_MS),
 * then close the database pools and the Valkey connection. Whether Next's own server waits for
 * this before exiting is verified at X-06, on ECS.
 */
const KEY = Symbol.for('nextkin.api');
type Holder = { [KEY]?: OpenAPIHono<ApiEnv> };

export function getApi(): OpenAPIHono<ApiEnv> {
  const holder = globalThis as Holder;
  const existing = holder[KEY];
  if (existing) return existing;

  const config = loadConfig();
  setEgressAllowlist(egressHostsFor(config));
  const log = createLogger(config.LOG_LEVEL, 'api');
  void startTracing('nextkin-api', config.OTEL_EXPORTER_OTLP_ENDPOINT);
  const db = createDatabase({
    appUrl: config.DATABASE_URL,
    maintenanceUrl: config.DATABASE_MAINTENANCE_URL,
    readonlyUrl: config.DATABASE_READONLY_URL,
    poolMax: config.DATABASE_POOL_MAX,
    onPrivilegedAccess: (e) =>
      log.info(
        {
          event: 'db.privileged',
          kind: e.kind,
          purpose: e.purpose,
          role: e.role,
        },
        'privileged access',
      ),
  });
  const valkey = new Valkey(config.VALKEY_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  const storage = buildStorage(config);
  valkey.on('error', () => {}); // surfaced through deep health and the rate limiter's fail-open log
  const inFlight: InFlight = { count: 0 };
  const identity = buildIdentity(config, db, valkey);
  // Generation progress (P6-13): events published after commits, fanned out to SSE streams over one
  // subscriber connection per process.
  const hub = createGenerationHub(valkey, log);
  const jobKv = createValkeyKv(valkey);
  // The assistant answers in this process (spec §9.13: the web role's streaming path). Without a live
  // model route it runs the deterministic stand-in, so local and CI need no key.
  const live = isLiveRoute(config);
  const assistantPending = new Set<Promise<void>>();
  // P12-06: the fake gateway delivers its signed webhooks to this API's own intake, like a real one.
  let deliver: WebhookDelivery = async () => {};
  const payments = buildPaymentProvider(config, () => deliver);
  deliver = async (raw, headers) => void (await ingestWebhook({ db, provider: payments, log }, raw, headers));
  // R-09: adapter failures are marked in Valkey, so every task and the worker show the same banner.
  const degraded = createDegradedSignal(jobKv);
  const gateway = live ? buildAiGateway(config, db, log, undefined, degraded) : undefined;
  const brain = gateway ? createModelBrain(gateway, dbPrompts(db)) : createStandInBrain();

  const api = createApi({
    checks: createDependencyChecks(config),
    config: {
      appEnv: config.APP_ENV,
      appOrigin: config.APP_ORIGIN,
      extraOrigins: config.APP_EXTRA_ORIGINS,
      cursorSecret: config.CURSOR_SECRET,
      trustedIpHeader: config.TRUSTED_IP_HEADER,
    },
    log,
    db,
    rateLimiter: createValkeyRateLimiter(valkey),
    idempotency: createValkeyIdempotencyStore(valkey),
    flags: createFlags(db),
    inFlight,
    identity: identity.identity,
    generations: { publisher: createValkeyPublisher(valkey), hub },
    jobs: {
      kv: jobKv,
      registry: createProviderRegistry({
        db,
        providers: buildProviders(config.JOBS_ADAPTER),
        log,
      }),
      breaker: createBreaker(jobKv),
    },
    files: buildFileDeps(config, db, storage),
    documents: { storage, exportsBucket: config.S3_BUCKET_EXPORTS },
    assistant: { brain, pending: assistantPending },
    ...(gateway ? { ai: { gateway, cache: jobKv } } : {}),
    billing: {
      provider: payments,
      email: createSmtpEmail(config.SMTP_URL, config.EMAIL_FROM),
    },
    supportInbox: config.SUPPORT_INBOX,
    degraded,
    secrets:
      config.SECRETS_ADAPTER === 'local'
        ? createLocalSecrets(jobKv)
        : (() => {
            throw new Error('SECRETS_ADAPTER=aws arrives with Secrets Manager (Connect item X-05).');
          })(),
  });
  holder[KEY] = api;

  const shutdown = async (signal: string) => {
    log.info({ event: 'shutdown', signal, inFlight: inFlight.count }, 'draining');
    const stillRunning = await waitForDrain(inFlight, config.SHUTDOWN_DRAIN_MS);
    if (stillRunning) log.warn({ event: 'shutdown', inFlight: stillRunning }, 'deadline passed with requests in flight');
    // Replies still being written finish (or fail) before the pools close.
    await Promise.race([Promise.allSettled([...assistantPending]), new Promise((resolve) => setTimeout(resolve, config.SHUTDOWN_DRAIN_MS))]);
    await Promise.allSettled([db.destroy(), valkey.quit(), identity.close(), hub.close()]);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
  return api;
}
