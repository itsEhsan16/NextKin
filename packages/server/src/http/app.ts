import { OpenAPIHono } from '@hono/zod-openapi';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { createAuthenticator } from '../auth/authenticator';
import { createMemoryStores, type IdempotencyStore, type RateLimiter } from '../cache/stores';
import type { Database } from '../db/database';
import { createStaticFlags, type Flags } from '../flags/flags';
import type { DependencyChecks } from '../health/checks';
import { createLogger, type Logger } from '../observability/logger';
import type { ApiEnv } from './env';
import { AppError, envelope, errors } from './errors';
import { requestContext, securityHeaders, type InFlight } from './middleware/context';
import { authenticate, clientVersionFloor, csrf, rateLimit, type Authenticator } from './middleware/guards';
import { setResponseValidation } from './respond';
import { trustedOrigins } from './origins';
import { authRoutes, type AuthRouteDeps } from './routes/auth';
import { federatedRoutes, type FederatedDeps } from './routes/authFederated';
import { healthRoutes } from './routes/health';
import { NO_SIGNAL, observedEmail, observedPayments, type DegradedSignal } from '../health/degraded';
import { accountRoutes } from './routes/account';
import { meRoutes } from './routes/me';
import { generationRoutes, type GenerationRouteDeps } from './routes/generations';
import { profileRoutes } from './routes/profile';
import { exportRoutes } from './routes/exports';
import { fitRoutes } from './routes/fit';
import { createStandInBrain, type AssistantBrain } from '../assistant/brain';
import { assistantRoutes } from './routes/assistant';
import { billingRoutes } from './routes/billing';
import { privacyRoutes } from './routes/privacy';
import { adminRoutes } from './routes/admin';
import { createLocalSecrets, type SecretsPort } from '../secrets/secrets';
import { supportRoutes } from './routes/support';
import type { EmailPort } from '../email/email';
import { createFakeProvider } from '../payments/fake';
import type { WebhookDelivery } from '../payments/build';
import type { PaymentProvider } from '../payments/types';
import { ingestWebhook } from '../services/billingWebhooks';
import { interviewRoutes } from './routes/interview';
import { sharedReportRoutes } from './routes/sharedReports';
import { skillRoutes } from './routes/skills';
import { applicationRoutes } from './routes/applications';
import { jobRoutes } from './routes/jobs';
import { notificationRoutes } from './routes/notifications';
import type { AiGateway } from '../ai/gateway';
import { createMemoryKv, type KvCache } from '../cache/kv';
import { createBreaker, type Breaker } from '../jobs/breaker';
import { buildProviders, createProviderRegistry, type ProviderRegistry } from '../jobs/registry';
import { jdRoutes } from './routes/jd';
import { tailorRoutes } from './routes/tailor';
import { resumeRoutes } from './routes/resumes';
import { resumeDocumentRoutes } from './routes/resumeDocument';
import type { StoragePort } from '../storage/storage';
import { uploadRoutes, type UploadRouteDeps } from './routes/uploads';

/**
 * The API, mounted by apps/web's catch-all at /api/v1 (V2 §9.3). The chain, in order
 * (ImBackendImplementationPlan P3-03):
 *
 *   request id + trace + timing + access log → security headers → body limit → client version
 *   floor → authentication → CSRF (cookie sessions) → rate limit → [per route: idempotency,
 *   kill switch] → zod validation → handler → response validation → error envelope
 */

export interface ApiConfig {
  appEnv: string;
  /** The web app's origin; cookie-session writes must come from it (CSRF). */
  appOrigin: string;
  /** Local only (toreview §131.10): more origins the app answers on, such as a tunnel's. */
  extraOrigins?: readonly string[];
  /** Signs pagination cursors. */
  cursorSecret: string;
  trustedIpHeader?: string;
}

export interface ApiDeps {
  checks: DependencyChecks;
  config?: Partial<ApiConfig>;
  log?: Logger;
  db?: Database;
  rateLimiter?: RateLimiter;
  idempotency?: IdempotencyStore;
  flags?: Flags;
  authenticate?: Authenticator;
  inFlight?: InFlight;
  /** Identity routes (P4). Present when the process has an identity provider and sessions. */
  identity?: Omit<AuthRouteDeps, 'db' | 'appOrigin'> & Omit<FederatedDeps, 'db' | 'appOrigin' | 'idp' | 'auth' | 'sessions'>;
  /** Uploads, parsing and the teaser (P7). Without storage these routes are not mounted. */
  files?: Omit<UploadRouteDeps, 'db' | 'signAvatar'>;
  /** Generation events (P6-13): who publishes cancel/retry events, and the SSE fan-out hub. */
  generations?: Omit<GenerationRouteDeps, 'db' | 'idempotency'>;
  /** The library's files (P10): permanent deletes and exports. Without it, those answer UNAVAILABLE. */
  documents?: { storage: StoragePort; exportsBucket: string };
  /** Job search (P11): the result cache, the providers and their breakers. Defaults to the fixture provider in memory. */
  jobs?: { kv: KvCache; registry: ProviderRegistry; breaker: Breaker };
  /** Model calls answered in the request (toreview §129's figure drafts). Absent: the rules answer. */
  ai?: { gateway: AiGateway; cache: KvCache };
  /** The assistant (P11-09): its classifier and reply model. Defaults to the deterministic stand-in. */
  assistant?: { brain: AssistantBrain; pending?: Set<Promise<void>> };
  /** Billing (P12): the payment provider and the mailer for receipts. Defaults to the fake gateway and no mail. */
  billing?: { provider?: PaymentProvider; email?: EmailPort };
  /** Where support tickets are emailed (P12-13); the mailer is the billing one. */
  supportInbox?: string;
  /** Write-only provider keys (P12-05). Defaults to an in-memory store. */
  secrets?: SecretsPort;
  /** R-09: where adapter failures are recorded for the degraded banner. */
  degraded?: DegradedSignal;
}

const DEFAULT_BODY_LIMIT = 256 * 1024;

export function createApi(deps: ApiDeps): OpenAPIHono<ApiEnv> {
  const config: ApiConfig = {
    appEnv: 'test',
    appOrigin: 'http://localhost:3000',
    cursorSecret: 'test-cursor-secret-not-for-real-use-000000',
    ...deps.config,
  };
  const isProduction = config.appEnv === 'production' || config.appEnv === 'staging';
  setResponseValidation(!isProduction);
  const memory = createMemoryStores();
  const log = deps.log ?? createLogger('silent', 'api');
  const flags = deps.flags ?? createStaticFlags();

  const app = new OpenAPIHono<ApiEnv>({
    // Schema failures become the standard envelope with field details, never a framework default.
    defaultHook: (result) => {
      if (!result.success) {
        throw errors.validation(
          result.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        );
      }
    },
  }).basePath('/api/v1');

  app.use(
    requestContext({
      log,
      trustedIpHeader: config.trustedIpHeader,
      inFlight: deps.inFlight ?? { count: 0 },
    }),
  );
  app.use(securityHeaders());
  app.use(
    bodyLimit({
      maxSize: DEFAULT_BODY_LIMIT,
      onError: () => {
        throw errors.payloadTooLarge();
      },
    }),
  );
  app.use(clientVersionFloor(flags));
  // Real sessions whenever identity is wired; tests may inject their own resolver.
  const resolver = deps.authenticate ?? (deps.identity ? createAuthenticator(deps.identity.idp, deps.identity.sessions) : async () => null);
  app.use(authenticate(resolver));
  app.use(csrf(trustedOrigins(config.appOrigin, config.extraOrigins)));
  app.use(rateLimit(deps.rateLimiter ?? memory.rateLimiter));

  const signal = deps.degraded ?? NO_SIGNAL;
  app.route('/', healthRoutes(deps.checks, signal));
  if (deps.db && deps.identity) {
    app.route(
      '/',
      authRoutes({
        ...deps.identity,
        db: deps.db,
        appOrigin: config.appOrigin,
        ...(config.extraOrigins ? { extraOrigins: config.extraOrigins } : {}),
      }),
    );
    app.route(
      '/',
      federatedRoutes({
        ...deps.identity,
        db: deps.db,
        appOrigin: config.appOrigin,
      }),
    );
  }
  if (deps.db) {
    const idempotency = deps.idempotency ?? memory.idempotency;
    app.route('/', meRoutes({ db: deps.db, idempotency, cursorSecret: config.cursorSecret }));
    const files = deps.files;
    const signAvatar = files ? (bucket: string, key: string) => files.uploads.storage.presignGet(bucket, key) : undefined;
    app.route(
      '/',
      accountRoutes({
        db: deps.db,
        cursorSecret: config.cursorSecret,
        idp: deps.identity?.idp,
        signAvatar,
      }),
    );
    if (files && signAvatar) app.route('/', uploadRoutes({ ...files, db: deps.db, signAvatar }));
    app.route('/', profileRoutes({ db: deps.db, idempotency }));
    app.route('/', jdRoutes(deps.db));
    app.route('/', tailorRoutes({ db: deps.db, log, ...(deps.ai ? { ai: deps.ai } : {}) }));
    app.route('/', generationRoutes({ ...deps.generations, db: deps.db, idempotency }));
    app.route(
      '/',
      resumeRoutes({
        db: deps.db,
        idempotency,
        ...(deps.documents ? { documents: deps.documents } : {}),
      }),
    );
    app.route('/', resumeDocumentRoutes({ db: deps.db }));
    app.route(
      '/',
      exportRoutes({
        db: deps.db,
        ...(deps.documents ? { documents: deps.documents } : {}),
      }),
    );
    const jobKv = deps.jobs?.kv ?? createMemoryKv();
    // "Fit to one page" outcomes share the cache the worker writes them to (toreview §113).
    app.route('/', fitRoutes({ db: deps.db, kv: jobKv }));
    const jobDeps = {
      kv: jobKv,
      registry:
        deps.jobs?.registry ??
        createProviderRegistry({
          db: deps.db,
          providers: buildProviders('fixture'),
          log,
        }),
      breaker: deps.jobs?.breaker ?? createBreaker(jobKv),
    };
    app.route('/', interviewRoutes(deps.db));
    app.route('/', applicationRoutes(deps.db));
    app.route('/', notificationRoutes(deps.db));
    {
      // Tests get the fake gateway, delivering its signed webhooks to this API's own intake.
      const db = deps.db;
      let deliver: WebhookDelivery = async () => {};
      const provider = observedPayments(
        deps.billing?.provider ??
          createFakeProvider({
            secret: 'test-fake-payments-secret',
            apiOrigin: config.appOrigin,
            deliver: () => deliver,
          }),
        signal,
      );
      const mailer = observedEmail(deps.billing?.email ?? { send: async () => {} }, signal);
      deliver = async (raw, headers) => void (await ingestWebhook({ db, provider, log }, raw, headers));
      app.route(
        '/',
        billingRoutes({
          db,
          provider,
          email: mailer,
          appOrigin: config.appOrigin,
          log,
        }),
      );
      app.route(
        '/',
        adminRoutes({
          db,
          log,
          provider,
          secrets: deps.secrets ?? createLocalSecrets(createMemoryKv()),
          ...(deps.identity ? { idp: deps.identity.idp, sessions: deps.identity.sessions } : {}),
        }),
      );
      app.route(
        '/',
        supportRoutes({
          db,
          email: mailer,
          inbox: deps.supportInbox ?? 'support@nextkin.test',
          log,
        }),
      );
      app.route(
        '/',
        privacyRoutes({
          db,
          log,
          provider,
          ...(deps.identity ? { idp: deps.identity.idp, sessions: deps.identity.sessions } : {}),
          ...(deps.documents
            ? {
                files: {
                  storage: deps.documents.storage,
                  exportsBucket: deps.documents.exportsBucket,
                },
              }
            : {}),
        }),
      );
    }
    app.route('/', sharedReportRoutes({ db: deps.db, appOrigin: config.appOrigin }));
    app.route('/', skillRoutes({ db: deps.db, appOrigin: config.appOrigin }));
    app.route(
      '/',
      assistantRoutes({
        db: deps.db,
        log,
        flags,
        brain: deps.assistant?.brain ?? createStandInBrain(),
        ...(deps.assistant?.pending ? { pending: deps.assistant.pending } : {}),
      }),
    );
    app.route(
      '/',
      jobRoutes({
        jobs: {
          db: deps.db,
          aggregate: { db: deps.db, log, ...jobDeps, signal },
          cursorSecret: config.cursorSecret,
        },
        idempotency,
        flags,
      }),
    );
  }

  app.openAPIRegistry.registerComponent('securitySchemes', 'session', {
    type: 'apiKey',
    in: 'cookie',
    name: '__Host-nk_session',
  });
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearer', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });

  // The live document for developers (P3-08). Not served in staging or production.
  if (!isProduction) app.get('/openapi.json', (c) => c.json(openApiDocument(app)));

  app.notFound((c) => c.json(envelope('NOT_FOUND', 'No such endpoint.', null, c.get('requestId') ?? null), 404));

  app.onError((error, c) => {
    const requestId = c.get('requestId') ?? null;
    if (error instanceof AppError) {
      for (const [name, value] of Object.entries(error.headers)) c.header(name, value);
      return c.json(envelope(error.code, error.message, error.details, requestId), error.status as 400);
    }
    // Database constraints are the last line of input validation (P5-04): a broken CHECK or an
    // impossible date is the client's mistake (400), a duplicate is a conflict (409). Only the
    // constraint name is returned, never row data.
    const pgCode = (error as { code?: unknown }).code;
    // 22P02: a malformed literal (an id that is not a uuid) reached a query. Services check ids
    // first; this is the backstop, so it is the client's 400, never a 500.
    if (typeof pgCode === 'string' && /^(23514|23502|22007|22008|22001|23505|22P02)$/.test(pgCode)) {
      const constraint = (error as { constraint?: string }).constraint ?? null;
      return pgCode === '23505' ? c.json(envelope('CONFLICT', 'That already exists.', { constraint }, requestId), 409) : c.json(envelope('VALIDATION_FAILED', 'Some of those values are not valid together.', { constraint }, requestId), 400);
    }
    // The database or cache is unreachable (a restart, a failover): temporary, so 503 with a retry
    // hint rather than an internal error (P13-02's restart drills). An exhausted pool is the same:
    // pg-pool's acquire timeout carries no code, only its message (found by the P13-03 SSE load).
    const sysCode = (error as { code?: unknown }).code;
    const unreachable = typeof sysCode === 'string' && (/^(08|57P0)/.test(sysCode) || ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE'].includes(sysCode));
    if (unreachable || /Connection terminated|timeout exceeded when trying to connect/i.test(String((error as Error).message))) {
      c.header('Retry-After', '5');
      return c.json(envelope('UNAVAILABLE', 'This is temporarily unavailable. Try again in a moment.', null, requestId), 503);
    }
    if (error instanceof HTTPException && error.status < 500) {
      return c.json(envelope('VALIDATION_FAILED', 'The request is not valid.', null, requestId), error.status as 400);
    }
    // Unknown failures: log the name for diagnosis, never send a stack trace or a message.
    (c.get('log') ?? log).error(
      {
        event: 'http.unhandled',
        errorName: error.name,
        route: c.req.routePath,
      },
      'unhandled error',
    );
    return c.json(envelope('INTERNAL', isProduction ? 'Something went wrong.' : `Unhandled ${error.name}.`, null, requestId), 500);
  });

  return app;
}

/** The OpenAPI 3.1 document for the API (P3-08): generated, checked in, and diffed in CI. */
export function openApiDocument(app: OpenAPIHono<ApiEnv>) {
  return app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: {
      title: 'NextKin API',
      version: '1',
      description: 'The NextKin Release 1 API (spec §11). Errors use the envelope { error: { code, message, details, request_id } }.',
    },
    servers: [{ url: '/' }],
  });
}
