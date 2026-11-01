import type { EmailPort } from '../email/email';
import type { PaymentProvider } from '../payments/types';
import { processWebhook } from '../services/billingWebhooks';
import { buildDataExport } from '../services/privacy';
import { runPromptEvaluation } from '../services/admin/prompts';
import { runTemplateEval } from '../../evals/promptEval';
import type { AiGateway } from '../ai/gateway';
import type { Database } from '../db/database';
import type { Logger } from '../observability/logger';
import { createOutboxRelay } from '../outbox/outbox';
import type { EventPublisher } from '../pipeline/events';
import type { OcrPort } from '../ocr/tesseract';
import type { IsolationLimits } from '../parsing/pool';
import { createRunner, MAX_RECEIVES, type RunnerDeps, type RunnerHooks } from '../pipeline/runner';
import type { ScanPort } from '../scan/scan';
import { createMemoryKv, type KvCache } from '../cache/kv';
import type { LatexCompiler } from '../export/latex/compile';
import type { LinkReader } from '../links/client';
import type { PdfRenderer } from '../export/renderPdf';
import { runExport } from '../services/exports';
import { failRender, runRender } from '../services/renders';
import { runFit } from '../services/resumeFit';
import { runJdExtract } from '../services/jd';
import { runParse } from '../services/resumeParse';
import { processTeaser } from '../services/teaser';
import { scanUpload } from '../services/uploads';
import type { StoragePort } from '../storage/storage';
import type { QueuePort } from '../queue/port';
import type { PushPort } from '../push/push';
import { runMaintenanceJob } from '../scheduler/jobs';
import { createScheduler } from '../scheduler/scheduler';
import { createConsumer } from './consumer';

/**
 * Assembles a worker (ImBackendImplementationPlan P6-03): the generation consumer (priority queue
 * first), the maintenance consumer, the outbox relay and the scheduler. The worker entrypoint and
 * the integration tests build it the same way, with their own queue and gateway.
 */
export interface WorkerDeps {
  db: Database;
  queue: QueuePort;
  gateway: AiGateway;
  publisher: EventPublisher;
  log: Logger;
  concurrency: number;
  generationTimeoutSeconds: number;
  visibilitySeconds?: number;
  hooks?: RunnerHooks;
  /** Tests: instrumented or slow pipelines in place of the real ones. */
  pipelines?: RunnerDeps['pipelines'];
  /** Uploads, scanning and parsing (P7). Without it, file messages fail and dead-letter. */
  files?: WorkerFiles;
  /** The 30-day JD extraction cache (P9-01): Valkey in the worker, in memory in tests. */
  cache?: KvCache;
  /** Export rendering and the trash purge (P10). Without it, export messages fail and dead-letter. */
  documents?: { storage: StoragePort; exportsBucket: string; pdf: PdfRenderer; latex?: LatexCompiler };
  /** The link reader (toreview §144.3). Without it, a link fails with a plain message. */
  links?: LinkReader;
  /** Billing (P12-07): stored webhooks are applied here. Without it, webhook messages fail and dead-letter. */
  billing?: { provider: PaymentProvider; email: EmailPort };
  /** P12-03: evaluate prompt releases with the gateway (a live model route); otherwise the reference model. */
  liveEvals?: boolean;
  /** P12-02: the audit archive bucket for the nightly export. */
  auditBucket?: string;
  /** Sends what's due; null where push is off. */
  push?: PushPort | null;
  /** Off in tests that drive the relay or the scheduler by hand. */
  relay?: boolean;
  scheduler?: boolean;
}

export interface WorkerFiles {
  storage: StoragePort;
  scanner: ScanPort;
  /** Created on first use and kept for the process: most documents never need OCR. */
  ocr: () => Promise<OcrPort>;
  uploadsBucket: string;
  anonymousBucket: string;
  limits: { documentBytes: number; avatarBytes: number };
  parse?: Partial<IsolationLimits>;
  teaser: { perIpPerHour: number; ipSalt: string };
}

export function buildWorker(deps: WorkerDeps) {
  const { log } = deps;
  const files = () => {
    if (!deps.files) throw new Error('this worker was built without file handling (P7)');
    const f = deps.files;
    return { db: deps.db, storage: f.storage, scanner: f.scanner, ocr: f.ocr, bucket: f.uploadsBucket, limits: f.limits, parse: f.parse };
  };
  const teaserDeps = () => {
    const f = deps.files!;
    return { db: deps.db, storage: f.storage, anonymousBucket: f.anonymousBucket, uploadsBucket: f.uploadsBucket, maxBytes: f.limits.documentBytes, perIpPerHour: f.teaser.perIpPerHour, ipSalt: f.teaser.ipSalt };
  };
  const cache = deps.cache ?? createMemoryKv();
  const runner = createRunner({ db: deps.db, gateway: deps.gateway, publisher: deps.publisher, log, pipelines: deps.pipelines, ...(deps.documents?.latex ? { latex: deps.documents.latex } : {}) }, deps.hooks);

  const generations = createConsumer({
    name: 'generations',
    queue: deps.queue,
    sources: ['generation-priority', 'generation-standard'],
    concurrency: deps.concurrency,
    visibilitySeconds: deps.visibilitySeconds,
    log,
    handler: async (message) => {
      const envelope = message.envelope;
      const lastAttempt = message.receiveCount >= MAX_RECEIVES;
      switch (envelope?.type) {
        case 'generation.run': {
          const outcome = await runner.run({ ...envelope.payload, correlationId: envelope.correlationId, receiveCount: message.receiveCount });
          log.info({ event: 'generation.processed', generationId: envelope.payload.generationId, outcome, receiveCount: message.receiveCount }, 'generation processed');
          return;
        }
        case 'upload.scan': {
          const row = await scanUpload({ ...files(), scanner: files().scanner }, envelope.payload, lastAttempt);
          log.info({ event: 'upload.scanned', status: row?.status ?? 'skipped' }, 'upload scanned');
          return;
        }
        case 'resume.parse': {
          const f = files();
          await runParse({ db: deps.db, storage: f.storage, gateway: deps.gateway, ocr: f.ocr, log, maxBytes: f.limits.documentBytes, limits: f.parse }, { ...envelope.payload, correlationId: envelope.correlationId }, lastAttempt);
          return;
        }
        case 'jd.extract': {
          const f = deps.files;
          const outcome = await runJdExtract(
            { db: deps.db, gateway: deps.gateway, cache, log, ...(deps.links ? { links: deps.links } : {}), ...(f ? { files: { storage: f.storage, maxBytes: f.limits.documentBytes, limits: f.parse } } : {}) },
            { ...envelope.payload, correlationId: envelope.correlationId },
            lastAttempt,
          );
          log.info({ event: 'jd.processed', outcome }, 'job description processed');
          return;
        }
        case 'export.render': {
          const d = deps.documents;
          if (!d) throw new Error('this worker was built without export rendering (P10)');
          const outcome = await runExport({ db: deps.db, storage: d.storage, bucket: d.exportsBucket, pdf: d.pdf, ...(d.latex ? { latex: d.latex } : {}), log }, envelope.payload, lastAttempt);
          log.info({ event: 'export.processed', outcome }, 'export processed');
          return;
        }
        case 'render.compile': {
          const d = deps.documents;
          // Without a compiler (most tests, a stack without the latex profile) the render is marked
          // unavailable rather than dead-lettered; the preview queues it again later.
          const outcome = d?.latex ? await runRender({ db: deps.db, storage: d.storage, bucket: d.exportsBucket, latex: d.latex, log }, envelope.payload, lastAttempt) : await failRender(deps.db, envelope.payload, 'unavailable');
          log.info({ event: 'render.processed', outcome }, 'render processed');
          return;
        }
        case 'resume.fit': {
          const outcome = await runFit({ db: deps.db, kv: cache, ...(deps.documents?.latex ? { latex: deps.documents.latex } : {}), log }, envelope.payload);
          log.info({ event: 'resume.fit.processed', outcome }, 'fit processed');
          return;
        }
        case 'teaser.process':
          await processTeaser({ ...teaserDeps(), scanner: files().scanner, limits: files().parse }, envelope.payload.teaserId, lastAttempt);
          return;
        default:
          throw new Error(`unexpected ${envelope?.type} on a generation queue`);
      }
    },
  });

  const maintenance = createConsumer({
    name: 'maintenance',
    queue: deps.queue,
    sources: ['maintenance'],
    concurrency: 1,
    visibilitySeconds: 120,
    log,
    handler: async (message) => {
      const envelope = message.envelope;
      if (envelope?.type === 'billing.webhook') {
        if (!deps.billing) throw new Error('this worker was built without billing (P12)');
        const applied = await processWebhook({ db: deps.db, log, ...deps.billing }, envelope.payload.webhookEventId);
        log.info({ event: 'billing.webhook_processed', applied }, 'billing webhook processed');
        return;
      }
      if (envelope?.type === 'prompt.evaluate') {
        // P12-03: with a live model route the worker's gateway evaluates; otherwise the reference model.
        const outcome = await runPromptEvaluation({ db: deps.db, log, gateway: deps.liveEvals ? deps.gateway : null, run: runTemplateEval }, envelope.payload.evaluationId);
        log.info({ event: 'prompts.evaluated', outcome }, 'prompt evaluated');
        return;
      }
      if (envelope?.type === 'account.export') {
        if (!deps.documents || !deps.files) throw new Error('this worker was built without storage for exports (P12-11)');
        const outcome = await buildDataExport({ db: deps.db, storage: deps.documents.storage, exportsBucket: deps.documents.exportsBucket, uploadsBucket: deps.files.uploadsBucket, log }, envelope.payload);
        log.info({ event: 'privacy.export_processed', outcome }, 'data export processed');
        return;
      }
      if (envelope?.type !== 'maintenance.run') throw new Error(`unexpected ${envelope?.type} on the maintenance queue`);
      const { job } = envelope.payload;
      const affected = await runMaintenanceJob(job, {
        db: deps.db,
        log,
        publisher: deps.publisher,
        generationTimeoutSeconds: deps.generationTimeoutSeconds,
        uploads: deps.files ? { ...files(), anonymousBucket: deps.files.anonymousBucket } : undefined,
        gateway: deps.gateway,
        ...(deps.documents ? { documents: { storage: deps.documents.storage, exportsBucket: deps.documents.exportsBucket } } : {}),
        ...(deps.auditBucket ? { auditBucket: deps.auditBucket } : {}),
        push: deps.push ?? null,
      });
      log.info({ event: 'maintenance.done', job, affected }, 'maintenance job done');
    },
  });

  const relay = createOutboxRelay({ db: deps.db, queue: deps.queue, log });
  const scheduler = createScheduler({ db: deps.db, log });

  return {
    generations,
    maintenance,
    relay,
    scheduler,
    runner,
    start() {
      if (deps.relay !== false) relay.start();
      if (deps.scheduler !== false) scheduler.start();
      generations.start();
      maintenance.start();
    },
    /** SIGTERM: stop taking work, finish or release in-flight work, then flush the outbox once. */
    async stop(graceMs = 20_000) {
      scheduler.stop();
      const results = await Promise.all([generations.stop(graceMs), maintenance.stop(graceMs)]);
      await relay.stop();
      return { generations: results[0], maintenance: results[1] };
    },
  };
}

export type Worker = ReturnType<typeof buildWorker>;
