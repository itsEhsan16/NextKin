import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { ListQueuesCommand, SQSClient } from '@aws-sdk/client-sqs';
import Valkey from 'iovalkey';
import pg from 'pg';
import type { Config } from '../config';

/**
 * Dependency checks for the deep health endpoint (R-08). The deep report feeds alarms and the
 * degraded-mode banner; it is never the load balancer's target, because every web task shares
 * these dependencies and a shared failure would drain every task at once.
 */

export type DependencyName = 'database' | 'valkey' | 'storage' | 'queue';
export type DependencyCheck = () => Promise<void>;
export type DependencyChecks = Record<DependencyName, DependencyCheck>;

export interface DependencyReport {
  name: DependencyName;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

const TIMEOUT_MS = 2_000;

function withTimeout(check: DependencyCheck): Promise<void> {
  return Promise.race([
    check(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS).unref(),
    ),
  ]);
}

export async function runChecks(checks: DependencyChecks): Promise<DependencyReport[]> {
  return Promise.all(
    (Object.keys(checks) as DependencyName[]).map(async (name) => {
      const started = performance.now();
      try {
        await withTimeout(checks[name]);
        return { name, ok: true, latencyMs: Math.round(performance.now() - started) };
      } catch (error) {
        return {
          name,
          ok: false,
          latencyMs: Math.round(performance.now() - started),
          // Messages only, never stack traces or connection strings.
          error: error instanceof Error ? error.message.slice(0, 200) : 'unknown error',
        };
      }
    }),
  );
}

/** Real checks against the configured services. Clients are created once and reused. */
export function createDependencyChecks(config: Config): DependencyChecks {
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 2 });
  pool.on('error', () => undefined); // the next check reports the database down; never crash on it
  const valkey = new Valkey(config.VALKEY_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  const s3 = new S3Client({
    region: config.AWS_REGION,
    endpoint: config.S3_ENDPOINT,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
  });
  const sqs = new SQSClient({ region: config.AWS_REGION, endpoint: config.SQS_ENDPOINT });

  return {
    database: async () => {
      await pool.query('select 1');
    },
    valkey: async () => {
      if (valkey.status === 'wait' || valkey.status === 'end') await valkey.connect();
      await valkey.ping();
    },
    storage: async () => {
      await s3.send(new HeadBucketCommand({ Bucket: config.S3_BUCKET_UPLOADS }));
    },
    queue: async () => {
      await sqs.send(new ListQueuesCommand({ MaxResults: 1 }));
    },
  };
}
