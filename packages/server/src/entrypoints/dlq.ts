import { loadConfig } from '../config';
import { createDatabase } from '../db/database';
import { inspectDlq, replayDlq } from '../ops/dlq';
import { QUEUES, type QueueName } from '../queue/envelope';
import { createSqsQueue } from '../queue/sqs';

/**
 * Dead-letter tooling (ImBackendImplementationPlan P6-05 and P13-05; aws/runbooks/dlq-replay.md).
 *
 *   pnpm dlq list [--queue <q>]                       what is dead-lettered, ids only
 *   pnpm dlq:replay                                    every DLQ, dry run
 *   pnpm dlq:replay -- --apply                         replays them
 *   pnpm dlq:replay -- --queue maintenance --type billing.webhook --limit 10 --apply
 *   pnpm dlq:replay -- --drop-poison --apply           also deletes bodies that do not parse
 *
 * Prints ids and counts, never a payload body.
 */
const [command, ...rest] = process.argv.slice(2).filter((a) => a !== '--');
const flag = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const queueArg = flag('--queue');
if (!command || !['list', 'replay'].includes(command) || (queueArg && !(QUEUES as readonly string[]).includes(queueArg))) {
  console.error(`usage: pnpm dlq list|replay [--queue <${QUEUES.join('|')}>] [--apply] [--type <type>] [--limit <n>] [--drop-poison]`);
  process.exit(2);
}
const queues: QueueName[] = queueArg ? [queueArg as QueueName] : [...QUEUES];
const max = Number(flag('--limit')) || 100;
const type = flag('--type');

const config = loadConfig();
const port = createSqsQueue({ region: config.AWS_REGION, endpoint: config.SQS_ENDPOINT, prefix: config.SQS_QUEUE_PREFIX });
const db = command === 'replay' ? createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL }) : undefined;
try {
  for (const queue of queues) {
    if (command === 'list') {
      const entries = await inspectDlq(port, queue, max);
      console.log(entries.length ? `${queue}-dlq:\n${JSON.stringify(entries, null, 2)}` : `${queue}-dlq is empty.`);
      continue;
    }
    const result = await replayDlq(port, queue, { apply: rest.includes('--apply'), dropPoison: rest.includes('--drop-poison'), max, ...(db ? { db } : {}), ...(type ? { type } : {}) });
    console.log(`${queue}-dlq: ${JSON.stringify(result, null, 2)}`);
  }
  if (command === 'replay' && !rest.includes('--apply')) console.log('dry run; add --apply to replay');
} finally {
  port.close?.();
  await db?.destroy();
}
