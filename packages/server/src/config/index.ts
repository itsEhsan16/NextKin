import { z } from 'zod';

/**
 * Typed configuration for every server process (ImBackendImplementationPlan P1-06, C-01).
 * Read once at start-up; a missing or invalid value fails immediately with a named error rather
 * than at the first request that needs it. This is the only module that reads process.env.
 */

export const APP_ENVS = ['local', 'test', 'dev', 'staging', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** Adapters that are stand-ins for a cloud service or vendor. L3: never in staging or production. */
const LOCAL_ONLY_ADAPTERS: Record<string, readonly string[]> = {
  IDENTITY_ADAPTER: ['local'],
  SCAN_ADAPTER: ['clamav'],
  OCR_ADAPTER: ['tesseract'],
  EMAIL_ADAPTER: ['smtp'],
  LLM_ROUTE: ['fake', 'recorded', 'claudeDirect', 'openrouter'],
  JOBS_ADAPTER: ['fixture', 'recorded'],
  PAYMENT_ADAPTER: ['fake', 'stripeMock'],
  SECRETS_ADAPTER: ['local'],
  PUSH_ADAPTER: ['log'],
};

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const schema = z.object({
  APP_ENV: z.enum(APP_ENVS),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // The app role: not the table owner, no BYPASSRLS (G7). Every request runs as this.
  DATABASE_URL: z.url(),
  // The owner role, used only by the migrate task.
  DATABASE_OWNER_URL: z.url().optional(),
  // Purge and sweep jobs (withSystem). Optional until P6 schedules them.
  DATABASE_MAINTENANCE_URL: z.url().optional(),
  // Staff reads (withStaff): support and admin, audited in application code.
  DATABASE_READONLY_URL: z.url().optional(),
  // Local superuser, used only by the volume seed. Refused outside local and test.
  DATABASE_ADMIN_URL: z.url().optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  // Relative to the working directory: the repo root locally, /app in the image.
  MIGRATIONS_DIR: z.string().min(1).default('aws/migrations'),
  VALKEY_URL: z.url(),

  AWS_REGION: z.string().min(1).default('us-east-1'),
  // Endpoint overrides point the real AWS SDK at the local stand-ins (L1). Unset in the cloud.
  S3_ENDPOINT: z.url().optional(),
  // Where a browser reaches the local stand-in, when the server reaches it by a container name.
  S3_PUBLIC_ENDPOINT: z.url().optional(),
  S3_FORCE_PATH_STYLE: bool.default(false),
  S3_BUCKET_UPLOADS: z.string().min(1).default('nextkin-uploads'),
  SQS_ENDPOINT: z.url().optional(),
  SQS_QUEUE_PREFIX: z.string().default(''),

  IDENTITY_ADAPTER: z.enum(['local', 'cognito']).default('local'),
  // No "always clean" choice exists: without clamd the verdict is `failed` (P7-03).
  SCAN_ADAPTER: z.enum(['clamav', 'guardduty']).default('clamav'),
  OCR_ADAPTER: z.enum(['tesseract', 'textract']).default('tesseract'),
  EMAIL_ADAPTER: z.enum(['smtp', 'ses']).default('smtp'),
  LLM_ROUTE: z.enum(['fake', 'recorded', 'claudeDirect', 'openrouter', 'claudeAws']).default('recorded'),
  JOBS_ADAPTER: z.enum(['fixture', 'recorded', 'providers']).default('fixture'),
  PAYMENT_ADAPTER: z.enum(['fake', 'stripeMock', 'stripe']).default('fake'),
  // P12-06. `stripeMock` is the Stripe adapter against stripe-mock (the `pay` profile); `stripe` is
  // test mode, then live, at X-13, and needs both keys. The fake signs its own webhooks.
  STRIPE_API_BASE: z.url().default('https://api.stripe.com'),
  STRIPE_MOCK_URL: z.url().default('http://127.0.0.1:12111'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_FAKE_SECRET: z.string().min(16).default('local-fake-payments-secret-not-real'),
  // P12-05: where write-only provider keys go. `local` is Valkey (a stand-in); `aws` is Secrets Manager at X-05.
  SECRETS_ADAPTER: z.enum(['local', 'aws']).default('local'),
  // P12-13: where support tickets are emailed.
  SUPPORT_INBOX: z.string().default('support@nextkin.test'),
  // P12-02: the nightly audit export (Object Lock at X-05).
  S3_BUCKET_AUDIT: z.string().min(1).default('nextkin-audit-archive'),

  WORKER_HEARTBEAT_SECONDS: z.coerce.number().int().min(1).max(3600).default(30),

  // --- Uploads, scanning and parsing (P7) ---
  CLAMAV_HOST: z.string().default('127.0.0.1'),
  CLAMAV_PORT: z.coerce.number().int().min(1).max(65535).default(3310),
  S3_BUCKET_ANONYMOUS: z.string().min(1).default('nextkin-anonymous-uploads'),
  // §7.4 / the board: 5 MB per document; avatars smaller.
  UPLOAD_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(50 * 1024 * 1024)
    .default(5 * 1024 * 1024),
  AVATAR_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(10 * 1024 * 1024)
    .default(2 * 1024 * 1024),

  // --- Documents and export (P10) ---
  S3_BUCKET_EXPORTS: z.string().min(1).default('nextkin-exports'),
  // The Chromium the worker renders PDFs with. Unset in the container, where Playwright's own build
  // is installed; set locally to a downloaded Chromium (e.g. ms-playwright/chromium-1234).
  CHROMIUM_PATH: z.string().min(1).optional(),
  // The sealed LaTeX compile service (toreview §111). Locally the `latex` compose profile, reached
  // through its relay on 127.0.0.1:8790. The bearer token comes from a file (preferred: the same
  // file the service mounts) or, where the platform injects secrets as variables, LATEX_COMPILER_TOKEN.
  LATEX_COMPILER_URL: z.url().default('http://127.0.0.1:8790'),
  LATEX_COMPILER_TOKEN_FILE: z.string().min(1).optional(),
  LATEX_COMPILER_TOKEN: z.string().min(32).optional(),
  // The link reader (toreview §144.3): a separate service, so pages from the open web never run in
  // the worker. Locally `pnpm link-reader` on 127.0.0.1:8791. The token comes as LaTeX's does.
  LINK_READER_URL: z.url().default('http://127.0.0.1:8791'),
  LINK_READER_TOKEN_FILE: z.string().min(1).optional(),
  LINK_READER_TOKEN: z.string().min(32).optional(),
  // The isolated parser thread's limits (P7-05).
  PARSE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(20_000),
  PARSE_HEAP_MB: z.coerce.number().int().min(64).max(2048).default(256),
  // The anonymous teaser (§4.1): uploads per IP per hour.
  TEASER_PER_IP_PER_HOUR: z.coerce.number().int().min(1).max(100).default(5),

  // --- Async backbone and AI (P6) ---
  // Jobs one worker process runs at once, across its queues.
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(4),
  // A generation still not finished after this many seconds is failed by the sweep (M2-04: 3 min).
  GENERATION_TIMEOUT_SECONDS: z.coerce.number().int().min(30).max(3600).default(180),
  // D-23: the developer's own Claude key, for LLM_ROUTE=claudeDirect. Synthetic data only (L4).
  ANTHROPIC_API_KEY: z.string().min(10).optional(),
  // The developer's own OpenRouter key, for LLM_ROUTE=openrouter (toreview §108): the same Claude
  // models through OpenRouter, under the same rules as ANTHROPIC_API_KEY.
  OPENROUTER_API_KEY: z.string().min(10).optional(),
  // D-23: the per-developer daily cap on live calls, in US dollars, on top of the console's limit.
  AI_DAILY_CAP_USD: z.coerce.number().min(0).max(1000).default(2),
  // Whose spend the cap counts. Calls are tagged `dev` while this is set.
  AI_DEVELOPER: z.string().max(120).default('local'),
  // Record mode: calls go to the live provider and each response is written as a fixture.
  AI_RECORD: z.stringbool().default(false),

  // Push (owner, 2026-11-01; V2 §9.12). `off` until a Firebase project and an Apple key sit behind
  // an SNS platform application for each platform; `log` is the local stand-in.
  PUSH_ADAPTER: z.enum(['off', 'log', 'sns']).default('off'),
  PUSH_SNS_ANDROID_ARN: z.string().min(1).optional(),
  PUSH_SNS_IOS_ARN: z.string().min(1).optional(),
  SNS_ENDPOINT: z.url().optional(),

  // --- API kernel (P3) ---
  // The web app's origin. Cookie-session writes must come from it (CSRF).
  APP_ORIGIN: z.url().default('http://localhost:3000'),
  // Local only (toreview §131.10): more browser origins to trust, comma-separated; one `*` per
  // pattern stands for a DNS label, e.g. https://*.trycloudflare.com for a quick tunnel.
  APP_EXTRA_ORIGINS: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : [],
    )
    .pipe(z.array(z.string().regex(/^https?:\/\/[^/\s]+$/, 'an origin such as https://*.trycloudflare.com'))),
  // Signs pagination cursors. Long and random in every shared environment.
  CURSOR_SECRET: z.string().min(32),
  // The header a trusted proxy puts the client IP in. CloudFront-Viewer-Address in the cloud;
  // locally Next sets X-Forwarded-For from the socket. Never trust X-Forwarded-For behind the edge.
  TRUSTED_IP_HEADER: z.enum(['cloudfront-viewer-address', 'x-forwarded-for']).optional(),
  // OTLP endpoint for traces: the `obs` compose profile locally, the ADOT collector in AWS.
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
  // How long a SIGTERM waits for in-flight requests before closing pools.
  SHUTDOWN_DRAIN_MS: z.coerce.number().int().min(0).max(60_000).default(10_000),

  // --- Identity (P4) ---
  SMTP_URL: z.string().default('smtp://127.0.0.1:1025'),
  EMAIL_FROM: z.string().default('NextKin <no-reply@nextkin.test>'),
  // Where the provider redirects back to; same origin as the web app (spec §9.1).
  API_PUBLIC_URL: z.url().optional(),
  // Comma-separated prefixes an app redirect may start with (C-12). exp:// is Expo Go: local only.
  MOBILE_REDIRECT_ALLOWLIST: z.string().default('nextkin://'),
  FEDERATION_GOOGLE_ISSUER: z.url().optional(),
  FEDERATION_APPLE_ISSUER: z.url().optional(),
  FEDERATION_CLIENT_ID: z.string().default('nextkin-local'),
  FEDERATION_CLIENT_SECRET: z.string().default('local-secret'),

  // --- Seeding a shared dev environment (toreview §133) ---
  // The seed's published password and TOTP secret are for laptops. A shared `dev` (the AWS demo)
  // seeds only when both are given, from Secrets Manager, so its accounts are not the repo's.
  SEED_PASSWORD: z.string().min(16).optional(),
  SEED_TOTP_SECRET: z
    .string()
    .regex(/^[A-Z2-7]{32}$/, '32 base32 characters (A-Z, 2-7)')
    .optional(),
});

export type Config = z.infer<typeof schema>;

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
  }
}

/**
 * Whether this is a production build. Read straight from NODE_ENV because it is needed exactly
 * when loadConfig() has failed: to decide how much of the failure a response may reveal.
 */
export function isProductionBuild(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Parses and validates configuration. Throws ConfigError naming every problem at once. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`));
  }
  const config = parsed.data;

  // L3: fakes and stand-ins cannot reach a shared environment that real users touch.
  if (config.APP_ENV === 'staging' || config.APP_ENV === 'production') {
    const refused = Object.entries(LOCAL_ONLY_ADAPTERS)
      .filter(([key, values]) => values.includes(String(config[key as keyof Config])))
      .map(([key]) => `${key}=${String(config[key as keyof Config])} is a local stand-in and is refused in ${config.APP_ENV}`);
    if (config.DATABASE_ADMIN_URL) refused.push(`DATABASE_ADMIN_URL (superuser) is refused in ${config.APP_ENV}`);
    if (config.TRUSTED_IP_HEADER === 'x-forwarded-for') {
      refused.push(`TRUSTED_IP_HEADER=x-forwarded-for is spoofable and refused in ${config.APP_ENV}; use cloudfront-viewer-address`);
    }
    if (config.MOBILE_REDIRECT_ALLOWLIST.split(',').some((p) => p.trim().startsWith('exp://'))) {
      refused.push(`MOBILE_REDIRECT_ALLOWLIST may not include exp:// (Expo Go) in ${config.APP_ENV}`);
    }
    if (/local|test|change-me/i.test(config.CURSOR_SECRET)) refused.push(`CURSOR_SECRET looks like a placeholder in ${config.APP_ENV}`);
    if (config.AI_RECORD) refused.push(`AI_RECORD (fixture recording) is refused in ${config.APP_ENV}`);
    if (config.ANTHROPIC_API_KEY) refused.push(`ANTHROPIC_API_KEY (a developer key, D-23) is refused in ${config.APP_ENV}; production uses Claude Platform on AWS`);
    if (config.OPENROUTER_API_KEY) refused.push(`OPENROUTER_API_KEY (a developer key, toreview §108) is refused in ${config.APP_ENV}`);
    if (config.LATEX_COMPILER_TOKEN && /local|test|change-me|dev/i.test(config.LATEX_COMPILER_TOKEN)) refused.push(`LATEX_COMPILER_TOKEN looks like a placeholder in ${config.APP_ENV}`);
    if (config.S3_ENDPOINT) refused.push(`S3_ENDPOINT override is refused in ${config.APP_ENV}`);
    if (config.S3_PUBLIC_ENDPOINT) refused.push(`S3_PUBLIC_ENDPOINT override is refused in ${config.APP_ENV}`);
    if (config.APP_EXTRA_ORIGINS.length) refused.push(`APP_EXTRA_ORIGINS (local tunnels) is refused in ${config.APP_ENV}`);
    if (config.SQS_ENDPOINT) refused.push(`SQS_ENDPOINT override is refused in ${config.APP_ENV}`);
    if (config.PAYMENT_ADAPTER === 'stripe' && (!config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET)) refused.push(`PAYMENT_ADAPTER=stripe needs STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in ${config.APP_ENV}`);
    if (config.SNS_ENDPOINT) refused.push(`SNS_ENDPOINT override is refused in ${config.APP_ENV}`);
    if (config.PUSH_ADAPTER === 'sns' && (!config.PUSH_SNS_ANDROID_ARN || !config.PUSH_SNS_IOS_ARN)) refused.push(`PUSH_ADAPTER=sns needs PUSH_SNS_ANDROID_ARN and PUSH_SNS_IOS_ARN in ${config.APP_ENV}`);
    if (refused.length) throw new ConfigError(refused);
  }
  return config;
}
