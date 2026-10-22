import Valkey from 'iovalkey';
import { buildAiGateway, isLiveRoute } from '../ai/build';
import { loadConfig } from '../config';
import { createDatabase } from '../db/database';
import { createDependencyChecks, runChecks } from '../health/checks';
import { createLogger } from '../observability/logger';
import { createValkeyKv } from '../cache/kv';
import { createValkeyPublisher } from '../pipeline/events';
import { dlqOf, QUEUES } from '../queue/envelope';
import { createTesseractOcr } from '../ocr/tesseract';
import { createSqsQueue } from '../queue/sqs';
import { createClamavScanner } from '../scan/scan';
import { buildStorage, teaserSalt } from '../storage/build';
import { createLatexCompiler } from '../export/latex/compile';
import { createPdfRenderer } from '../export/renderPdf';
import { egressHostsFor, latexEgressHosts, setEgressAllowlist } from '../net/egress';
import { buildWorker } from '../worker/build';
import { createDegradedSignal } from '../health/degraded';
import { createSmtpEmail } from '../email/email';
import { buildPaymentProvider } from '../payments/build';

/**
 * The worker process (same image as `web`, its own entrypoint — V2 §9.5; ImBackendImplementationPlan
 * P6-03). It runs the generation and maintenance consumers, the outbox relay and the scheduler, and
 * logs a heartbeat with its dependencies, its consumers and every queue's depth (DLQs included).
 */

const config = loadConfig();
setEgressAllowlist([...egressHostsFor(config), ...latexEgressHosts(config)]);
const log = createLogger(config.LOG_LEVEL, 'worker');
const checks = createDependencyChecks(config);

// Routine system access (the relay, the scheduler, AI traces) runs every second; it is logged at
// debug so the info log stays readable. The audit trail proper is P12-02.
const ROUTINE = /^(outbox|scheduler|ai|pipeline): /;
const db = createDatabase({
  appUrl: config.DATABASE_URL,
  maintenanceUrl: config.DATABASE_MAINTENANCE_URL,
  onPrivilegedAccess: (e) => (ROUTINE.test(e.purpose) ? log.debug : log.info).call(log, { event: 'db.privileged', kind: e.kind, purpose: e.purpose, role: e.role }, 'privileged access'),
});
const valkey = new Valkey(config.VALKEY_URL, { maxRetriesPerRequest: 1 });
const storage = buildStorage(config);
let ocr: ReturnType<typeof createTesseractOcr> | undefined;
const pdf = createPdfRenderer(config.CHROMIUM_PATH ? { executablePath: config.CHROMIUM_PATH } : {});
// The sealed LaTeX service (toreview §111) once its token is configured; without it resumes keep
// the Chromium PDF and their previews stay structured.
const latex = config.LATEX_COMPILER_TOKEN || config.LATEX_COMPILER_TOKEN_FILE ? createLatexCompiler(config) : undefined;
const queue = createSqsQueue({ region: config.AWS_REGION, endpoint: config.SQS_ENDPOINT, prefix: config.SQS_QUEUE_PREFIX });

const worker = buildWorker({
  db,
  queue,
  gateway: buildAiGateway(config, db, log, undefined, createDegradedSignal(createValkeyKv(valkey))),
  publisher: createValkeyPublisher(valkey),
  cache: createValkeyKv(valkey),
  log,
  concurrency: config.WORKER_CONCURRENCY,
  generationTimeoutSeconds: config.GENERATION_TIMEOUT_SECONDS,
  files: {
    storage,
    scanner: createClamavScanner({ host: config.CLAMAV_HOST, port: config.CLAMAV_PORT }),
    ocr: () => (ocr ??= createTesseractOcr()),
    uploadsBucket: config.S3_BUCKET_UPLOADS,
    anonymousBucket: config.S3_BUCKET_ANONYMOUS,
    limits: { documentBytes: config.UPLOAD_MAX_BYTES, avatarBytes: config.AVATAR_MAX_BYTES },
    parse: { timeoutMs: config.PARSE_TIMEOUT_MS, heapMb: config.PARSE_HEAP_MB },
    teaser: { perIpPerHour: config.TEASER_PER_IP_PER_HOUR, ipSalt: teaserSalt(config) },
  },
  // One warm Chromium for the life of the process (P10-04); launched on the first export.
  documents: { storage, exportsBucket: config.S3_BUCKET_EXPORTS, pdf, ...(latex ? { latex } : {}) },
  liveEvals: isLiveRoute(config),
  auditBucket: config.S3_BUCKET_AUDIT,
  // P12-07: the worker applies stored webhooks; it never asks the gateway for a change itself.
  billing: {
    provider: buildPaymentProvider(config, () => async () => {
      throw new Error('the worker does not deliver webhooks');
    }),
    email: createSmtpEmail(config.SMTP_URL, config.EMAIL_FROM),
  },
});

async function heartbeat(): Promise<void> {
  const dependencies = await runChecks(checks);
  const degraded = dependencies.filter((d) => !d.ok).map((d) => d.name);
  const depths: Record<string, unknown> = {};
  for (const name of [...QUEUES, ...QUEUES.map(dlqOf)]) {
    depths[name] = await queue.stats(name).catch(() => null);
  }
  log.info(
    { event: 'heartbeat', degraded, dependencies, consumers: { generations: worker.generations.metrics, maintenance: worker.maintenance.metrics }, queues: depths },
    degraded.length ? 'worker degraded' : 'worker ok',
  );
}

const timer = setInterval(() => void heartbeat(), config.WORKER_HEARTBEAT_SECONDS * 1000);
worker.start();
log.info({ event: 'start', appEnv: config.APP_ENV, concurrency: config.WORKER_CONCURRENCY, llmRoute: config.LLM_ROUTE }, 'worker started');
void heartbeat();

// SIGTERM is how ECS (and `docker stop`) asks for a clean stop: stop polling, let in-flight runs
// finish within the grace period, release the rest for another worker to resume (P6-03).
let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  log.info({ event: 'stop', signal }, 'worker stopping');
  clearInterval(timer);
  const result = await worker.stop(20_000);
  log.info({ event: 'stopped', ...result }, 'worker stopped');
  queue.close();
  if (ocr) await (await ocr).close();
  await pdf.close();
  await db.destroy();
  valkey.disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
// An unexpected rejection means the process state is unknown: log it and exit so the orchestrator
// restarts a clean worker (P3-10). Unacknowledged messages are redelivered and resume from their checkpoint.
process.on('unhandledRejection', (reason) => {
  log.error({ event: 'unhandled_rejection', errorName: reason instanceof Error ? reason.name : typeof reason }, 'unhandled rejection; exiting');
  process.exit(1);
});
