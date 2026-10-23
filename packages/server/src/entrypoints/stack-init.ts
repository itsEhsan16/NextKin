import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { GetQueueUrlCommand, SQSClient } from '@aws-sdk/client-sqs';
import { loadConfig } from '../config';

/**
 * Creates the local buckets and confirms the local queues (ImBackendImplementationPlan P1-08).
 * Idempotent: safe to run on every `pnpm dev:all`. Refuses to run against a real AWS account —
 * buckets and queues there are created by CDK (X-05), never by a script.
 */

/** The five buckets of spec §9.4.3, under local names. */
export const LOCAL_BUCKETS = [
  'nextkin-uploads',
  'nextkin-anonymous-uploads',
  'nextkin-exports',
  'nextkin-audit-archive',
  'nextkin-public-assets',
] as const;

/** Queues defined in docker/elasticmq/elasticmq.conf, with their DLQs. */
export const LOCAL_QUEUES = [
  'generation-priority.fifo',
  'generation-priority-dlq.fifo',
  'generation-standard.fifo',
  'generation-standard-dlq.fifo',
  'maintenance.fifo',
  'maintenance-dlq.fifo',
] as const;

const config = loadConfig();
if (!config.S3_ENDPOINT || !config.SQS_ENDPOINT) {
  console.error('stack:init only runs against local stand-ins (S3_ENDPOINT and SQS_ENDPOINT must be set).');
  process.exit(1);
}

const s3 = new S3Client({
  region: config.AWS_REGION,
  endpoint: config.S3_ENDPOINT,
  forcePathStyle: config.S3_FORCE_PATH_STYLE,
});
const sqs = new SQSClient({ region: config.AWS_REGION, endpoint: config.SQS_ENDPOINT });

for (const Bucket of LOCAL_BUCKETS) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket }));
    console.log(`bucket ${Bucket}: exists`);
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket }));
    console.log(`bucket ${Bucket}: created`);
  }
}

const missing: string[] = [];
for (const QueueName of LOCAL_QUEUES) {
  try {
    await sqs.send(new GetQueueUrlCommand({ QueueName }));
  } catch {
    missing.push(QueueName);
  }
}
if (missing.length) {
  console.error(`queues missing (check docker/elasticmq/elasticmq.conf): ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`queues: all ${LOCAL_QUEUES.length} present`);
