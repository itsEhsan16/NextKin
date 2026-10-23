import { UPLOAD_TYPES, type PresignResponse, type Upload, type UploadPurpose } from '@nextkin/shared/schemas/uploads';
import { sql, type Selectable } from 'kysely';
import type { Database, Identity, Tx } from '../db/database';
import type { Uploads } from '../db/types.generated';
import { AppError, errors } from '../http/errors';
import { enqueue } from '../outbox/outbox';
import { sniff } from '../parsing/analyzer';
import type { FileKind } from '../parsing/types';
import { generationGroup } from '../queue/envelope';
import type { ScanPort } from '../scan/scan';
import { quarantineKey, userUploadKey, type StoragePort } from '../storage/storage';

/**
 * Uploads (ImBackendImplementationPlan P7-01, P7-03; spec §9.4.3, G6).
 *
 * presign → the client POSTs straight to storage → confirm → scan → `clean`. Nothing reads an
 * object until it is clean: the parser, the avatar and every presigned GET check the status first.
 * An infected object is moved under `quarantine/` (never presigned) and the row says so.
 */

export interface UploadDeps {
  db: Database;
  storage: StoragePort;
  bucket: string;
  limits: { documentBytes: number; avatarBytes: number };
}

export type UploadRow = Selectable<Uploads>;

/** What the bytes must be for each purpose, whatever the file was called. */
export const PURPOSE_KINDS: Record<UploadPurpose, readonly FileKind[]> = {
  resume: ['pdf', 'docx', 'txt'],
  jd: ['pdf', 'docx', 'txt'],
  avatar: ['png', 'jpeg', 'webp'],
};

const MESSAGES = {
  infected: 'This file looks unsafe, so we removed it. Upload a different copy.',
  type: 'That file is not the kind it says it is. Upload a PDF, Word (DOCX) or plain-text file.',
  scanFailed: 'We could not check this file. Try uploading it again.',
} as const;

export const toUpload = (row: UploadRow): Upload => {
  const result = (row.scan_result ?? {}) as { message?: string };
  return {
    id: row.id,
    purpose: row.purpose as UploadPurpose,
    fileName: row.file_name,
    status: row.status as Upload['status'],
    ...(result.message ? { error: result.message } : {}),
  };
};

const maxBytes = (deps: UploadDeps, purpose: UploadPurpose) => (purpose === 'avatar' ? deps.limits.avatarBytes : deps.limits.documentBytes);

export async function presignUpload(deps: UploadDeps, identity: Identity, input: { purpose: UploadPurpose; fileName: string; contentType: string; size: number }): Promise<PresignResponse> {
  const limit = maxBytes(deps, input.purpose);
  if (!UPLOAD_TYPES[input.purpose].includes(input.contentType)) {
    throw errors.validation({ contentType: 'not allowed' }, input.purpose === 'avatar' ? 'Upload a JPEG, PNG or WebP image.' : 'Upload a PDF, Word (DOCX) or plain-text file.');
  }
  if (input.size > limit) throw new AppError('PAYLOAD_TOO_LARGE', `That file is larger than ${Math.round(limit / 1024 / 1024)} MB.`);
  const key = userUploadKey(identity.userId);
  const row = await deps.db.withUser(identity, (tx) =>
    tx
      .insertInto('uploads')
      .values({ user_id: identity.userId, purpose: input.purpose, bucket: deps.bucket, object_key: key, file_name: input.fileName, declared_type: input.contentType })
      .returningAll()
      .executeTakeFirstOrThrow(),
  );
  // The policy fixes the key, the exact type and the size ceiling; storage enforces all three.
  const post = await deps.storage.presignPost({ bucket: deps.bucket, key, contentType: input.contentType, maxBytes: limit });
  return { upload: toUpload(row), ...post };
}

async function own(tx: Tx, id: string): Promise<UploadRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw errors.notFound('upload');
  const row = await tx.selectFrom('uploads').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
  if (!row) throw errors.notFound('upload');
  return row;
}

/** The client says the POST finished: the object must exist, then the scan is requested. */
export async function confirmUpload(deps: UploadDeps, identity: Identity, id: string, correlationId: string | null): Promise<Upload> {
  return deps.db.withUser(identity, async (tx) => {
    const row = await own(tx, id);
    if (row.status !== 'pending') return toUpload(row);
    const head = await deps.storage.head(row.bucket, row.object_key);
    if (!head) throw errors.conflict('The file has not arrived yet. Upload it, then confirm.');
    const updated = await tx
      .updateTable('uploads')
      .set({ status: 'scanning', size_bytes: head.size, confirmed_at: sql`now()` })
      .where('id', '=', row.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await enqueue(tx, { queue: 'generation-standard', groupId: generationGroup(identity.userId, row.id), type: 'upload.scan', payload: { uploadId: row.id, userId: identity.userId }, correlationId });
    return toUpload(updated);
  });
}

export async function getUpload(db: Database, identity: Identity, id: string): Promise<Upload> {
  return db.withUser(identity, async (tx) => toUpload(await own(tx, id)));
}

/**
 * The scan (worker, as the upload's owner). Reads the object, scans it, checks its bytes match its
 * purpose, and records the verdict. A failed scan (clamd unreachable) is thrown back for a retry;
 * on the last allowed attempt it is recorded as failed.
 */
export async function scanUpload(deps: UploadDeps & { scanner: ScanPort }, message: { uploadId: string; userId: string }, lastAttempt: boolean): Promise<UploadRow | null> {
  const identity: Identity = { userId: message.userId, role: 'user' };
  const row = await deps.db.withUser(identity, (tx) => tx.selectFrom('uploads').selectAll().where('id', '=', message.uploadId).executeTakeFirst());
  if (!row || row.status !== 'scanning') return null;
  const bytes = await deps.storage.read(row.bucket, row.object_key, maxBytes(deps, row.purpose as UploadPurpose));
  const verdict = await deps.scanner.scan(bytes);

  if (verdict.verdict === 'failed' && !lastAttempt) throw new Error(`scan failed: ${verdict.reason}`);
  let status: 'clean' | 'infected' | 'failed' = verdict.verdict === 'clean' ? 'clean' : verdict.verdict;
  let message_: string | undefined = verdict.verdict === 'infected' ? MESSAGES.infected : verdict.verdict === 'failed' ? MESSAGES.scanFailed : undefined;
  let key = row.object_key;
  const kind = sniff(bytes);

  if (verdict.verdict === 'infected') {
    key = quarantineKey(row.object_key);
    await deps.storage.copy({ bucket: row.bucket, key: row.object_key }, { bucket: row.bucket, key });
    await deps.storage.remove(row.bucket, row.object_key);
  } else if (status === 'clean' && !PURPOSE_KINDS[row.purpose as UploadPurpose].includes(kind)) {
    status = 'failed';
    message_ = MESSAGES.type;
    await deps.storage.remove(row.bucket, row.object_key);
  }

  return deps.db.withUser(identity, async (tx) => {
    const updated = await tx
      .updateTable('uploads')
      .set({
        status,
        sniffed_type: kind,
        object_key: key,
        scanned_at: sql`now()`,
        scan_result: JSON.stringify({ verdict: verdict.verdict, ...(verdict.verdict === 'infected' ? { signature: verdict.signature } : {}), ...(message_ ? { message: message_ } : {}) }),
      })
      .where('id', '=', row.id)
      .where('status', '=', 'scanning')
      .returningAll()
      .executeTakeFirst();
    if (!updated) return null;
    // A parse waiting on this scan is released (clean) or failed (anything else).
    const waiting = await tx.selectFrom('resume_parses').select('id').where('upload_id', '=', row.id).where('status', '=', 'waiting_scan').execute();
    for (const parse of waiting) {
      if (status === 'clean') {
        await tx.updateTable('resume_parses').set({ status: 'queued' }).where('id', '=', parse.id).execute();
        await enqueue(tx, { queue: 'generation-standard', groupId: generationGroup(message.userId, parse.id), type: 'resume.parse', payload: { parseId: parse.id, userId: message.userId }, correlationId: null });
      } else {
        await tx
          .updateTable('resume_parses')
          // A scanner that could not be reached is our outage, not the file's fault: `provider`, which
          // the client shows as "try again" rather than "this file has no text" (toreview §131).
          .set({ status: 'failed', finished_at: sql`now()`, error_code: status === 'infected' ? 'infected' : verdict.verdict === 'failed' ? 'provider' : 'unreadable', error_message: message_ ?? MESSAGES.scanFailed })
          .where('id', '=', parse.id)
          .execute();
      }
    }
    return updated;
  });
}

/** A clean upload's presigned GET (15 minutes at most); anything else is refused. */
export async function signedUrlFor(deps: UploadDeps, row: Pick<UploadRow, 'status' | 'bucket' | 'object_key'>): Promise<string> {
  if (row.status !== 'clean') throw errors.conflict('This file is not available.');
  return deps.storage.presignGet(row.bucket, row.object_key);
}

/**
 * The orphan sweep (R-12, hourly): an upload never confirmed within an hour is abandoned; its object
 * (if it arrived) is deleted and the row marked deleted. Found as the system, removed per row.
 */
export async function sweepOrphanUploads(deps: UploadDeps): Promise<number> {
  const stale = await deps.db.withSystem('uploads: find abandoned uploads', (tx) =>
    tx.selectFrom('uploads').select(['id', 'user_id', 'bucket', 'object_key']).where('status', '=', 'pending').where('created_at', '<', sql<Date>`now() - interval '1 hour'`).limit(500).execute(),
  );
  for (const row of stale) {
    await deps.storage.remove(row.bucket, row.object_key).catch(() => {});
    await deps.db.withSystem('uploads: mark an abandoned upload deleted', (tx) =>
      tx.updateTable('uploads').set({ status: 'deleted' }).where('id', '=', row.id).where('status', '=', 'pending').execute(),
    );
  }
  return stale.length;
}
