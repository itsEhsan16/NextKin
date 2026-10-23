/**
 * The worker the kill drill (P13-02) kills with SIGKILL: a real process, so its visibility
 * heartbeat dies with it. Its draft stage never returns; the drill kills it while that stage runs.
 */
import { loadConfig } from '../../src/config';
import { createDatabase } from '../../src/db/database';
import { createAiGateway } from '../../src/ai/gateway';
import { createFakeProvider } from '../../src/ai/providers/fake';
import { createAiSettings } from '../../src/ai/routing';
import { createDbTrace } from '../../src/ai/trace';
import { createLogger } from '../../src/observability/logger';
import { HELLO_PIPELINES, helloPipeline } from '../../src/pipeline/stages';
import { createSqsQueue } from '../../src/queue/sqs';
import { buildWorker } from '../../src/worker/build';

const config = loadConfig();
const log = createLogger('silent', 'dying-worker');
const db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 2 });
const queue = createSqsQueue({ region: config.AWS_REGION, endpoint: config.SQS_ENDPOINT, prefix: config.SQS_QUEUE_PREFIX });
const gateway = createAiGateway({ settings: createAiSettings(db, 0), providers: { resolve: () => createFakeProvider(), isDeveloperKey: () => false }, trace: createDbTrace(db, log), log, developer: 'drill', dailyCapUsd: 0 });
const hang = { ...helloPipeline, stages: [{ name: 'draft', status: 'generating' as const, run: () => new Promise<never>(() => {}) }, ...helloPipeline.stages.slice(1)] };
buildWorker({ db, queue, gateway, publisher: { publish: async () => {} } as never, log, concurrency: 1, generationTimeoutSeconds: 600, visibilitySeconds: 5, pipelines: { ...HELLO_PIPELINES, resume: hang }, relay: false, scheduler: false }).start();
console.log('dying worker started');
