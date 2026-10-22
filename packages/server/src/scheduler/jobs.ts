import { sql } from 'kysely';
import type { AiGateway } from '../ai/gateway';
import { runKbCandidates } from '../services/kbCandidates';
import { computeSkillTrends } from '../services/skillsExplorer';
import { purgeDeletedAccounts, purgeExpiredExports } from '../services/privacy';
import { exportAuditDay } from '../services/admin/audit';
import type { Database } from '../db/database';
import type { Logger } from '../observability/logger';
import { cleanupOutbox } from '../outbox/outbox';
import type { EventPublisher } from '../pipeline/events';
import type { MaintenanceJob } from '../queue/envelope';
import type { StoragePort } from '../storage/storage';
import { sweepStuckGenerations } from '../services/generations';
import { purgeDocuments, TRASH_DAYS } from '../services/resumes';
import { purgeTeasers } from '../services/teaser';
import { sweepOrphanUploads, type UploadDeps } from '../services/uploads';
import { cleanupSchedulerRuns } from './scheduler';

/**
 * The maintenance jobs (P6-06). Each is idempotent: running one twice for a window changes nothing
 * the second time. Jobs whose data does not exist yet say so in the log rather than pretend.
 */
export interface JobDeps {
  db: Database;
  log: Logger;
  publisher: EventPublisher;
  generationTimeoutSeconds: number;
  /** P7: storage for the orphan sweep and the anonymous purge. */
  uploads?: UploadDeps & { anonymousBucket: string };
  /** P9-07: the KB candidates job asks the fast tier. Without it, the job does nothing. */
  gateway?: AiGateway;
  /** P10-03: the trash purge deletes exported files by reference. Without storage it does nothing. */
  documents?: { storage: StoragePort; exportsBucket: string };
  /** P12-02: the bucket the nightly audit export writes to (Object Lock at X-05). */
  auditBucket?: string;
  /** The clock, injectable so the 30-day boundary can be tested (day 29 kept, day 31 gone). */
  now?: () => Date;
}

export async function runMaintenanceJob(job: MaintenanceJob, deps: JobDeps): Promise<number> {
  const { db, log } = deps;
  switch (job) {
    case 'generation_sweep':
      return sweepStuckGenerations(db, deps.publisher, deps.generationTimeoutSeconds);
    case 'upload_orphan_sweep':
      return deps.uploads ? sweepOrphanUploads(deps.uploads) : 0;
    case 'anonymous_upload_purge':
      return deps.uploads ? purgeTeasers({ db, storage: deps.uploads.storage, anonymousBucket: deps.uploads.anonymousBucket }) : 0;
    case 'outbox_cleanup':
      return (await cleanupOutbox(db)) + (await cleanupSchedulerRuns(db));
    case 'trash_purge': {
      // §7.11: 30 days in the trash, then a hard purge; files by reference, never a lifecycle rule.
      if (!deps.documents) {
        log.warn({ event: 'maintenance.skipped', job }, 'trash purge needs storage to delete exported files; skipped');
        return 0;
      }
      const documents = deps.documents;
      const cutoff = new Date((deps.now?.() ?? new Date()).getTime() - TRASH_DAYS * 24 * 3600 * 1000);
      return db.withSystem('maintenance: purge resumes past the 30-day trash', async (tx) => {
        const due = await tx.selectFrom('resumes').select('id').where('trashed_at', '<', cutoff).limit(500).execute();
        return purgeDocuments(tx, documents, due.map((r) => r.id));
      });
    }
    case 'jobs_cache_expiry': {
      const result = await db.withSystem('maintenance: delete expired job listings', (tx) =>
        tx.deleteFrom('jobs_cache').where('expires_at', '<', sql<Date>`now()`).executeTakeFirst(),
      );
      return Number(result.numDeletedRows);
    }
    case 'kb_candidates':
      return deps.gateway ? runKbCandidates({ db, gateway: deps.gateway, log }) : 0;
    case 'audit_export':
      // P12-02: yesterday's audit rows, one object per day; re-running a day rewrites the same object.
      return deps.documents && deps.auditBucket ? exportAuditDay({ db, storage: deps.documents.storage, bucket: deps.auditBucket }) : 0;
    case 'account_purge': {
      // P12-11: deleted accounts and expired export archives; files by reference, never a lifecycle rule.
      if (!deps.documents || !deps.uploads) {
        log.warn({ event: 'maintenance.skipped', job }, 'account purge needs storage to delete files; skipped');
        return 0;
      }
      const privacyDeps = { db, storage: deps.documents.storage, exportsBucket: deps.documents.exportsBucket, uploadsBucket: deps.uploads.bucket, log };
      return (await purgeDeletedAccounts(privacyDeps)) + (await purgeExpiredExports(privacyDeps));
    }
    case 'trending':
      // §7.14: anonymous aggregates only, each at or above the threshold (P11-07).
      return computeSkillTrends(db);
    case 'eval_nightly': {
      const owner = 'X-11 (until then the golden set runs on demand: pnpm eval)';
      log.info({ event: 'maintenance.not_built', job, owner }, `nothing to do until ${owner}`);
      return 0;
    }
  }
}
