import { createHash } from 'node:crypto';
import { UPLOAD_TYPES, type PresignResponse, type Teaser } from '@nextkin/shared/schemas/uploads';
import { sql, type Selectable } from 'kysely';
import type { Database, Identity } from '../db/database';
import type { AnonymousUploads } from '../db/types.generated';
import { AppError, errors } from '../http/errors';
import { enqueue } from '../outbox/outbox';
import { analyzeIsolated, type IsolationLimits } from '../parsing/pool';
import { UnreadableError } from '../parsing/types';
import type { ScanPort } from '../scan/scan';
import { anonymousKey, userUploadKey, type StoragePort } from '../storage/storage';
import { toUpload } from './uploads';

/**
 * The anonymous teaser (spec §4.1; ImBackendImplementationPlan P7-08). Anyone can drop a resume and
 * see what a parser makes of it before signing up. Rules:
 * - per-IP limits (the IP is kept only as a salted hash);
 * - scanned like any upload; analysed in the isolated parser; no model is called;
 * - D-15: the parts and the findings, never a total score without a JD. Until the rubric engine
 *   (P8) the parts are deterministic facts — readable or not, OCR needed, sections found, hidden text;
 * - an hourly purge deletes anything older than 24 hours (the bucket's lifecycle rule backs it up);
 * - signing up can claim the file: it is copied into the new account's prefix as a clean upload.
 */

export interface TeaserDeps {
  db: Database;
  storage: StoragePort;
  anonymousBucket: string;
  uploadsBucket: string;
  maxBytes: number;
  perIpPerHour: number;
  /** Salts the IP hash so a leaked table does not map back to addresses. */
  ipSalt: string;
}

type Row = Selectable<AnonymousUploads>;
const toTeaser = (row: Row): Teaser => ({
  id: row.id,
  status: row.status as Teaser['status'],
  ...(row.findings ? { findings: row.findings as Teaser['findings'] } : {}),
  ...(row.status === 'infected' ? { error: 'This file looks unsafe, so we removed it.' } : row.status === 'failed' ? { error: 'We couldn’t read this file.' } : {}),
});

export const RETENTION_HOURS = 24;
const SECTION_HEADINGS: Record<string, RegExp> = {
  summary: /^\s*(summary|profile|about( me)?|objective|profil|zusammenfassung)\s*:?\s*$/im,
  experience: /^\s*(experience|work experience|employment( history)?|professional experience|berufserfahrung)\s*:?\s*$/im,
  education: /^\s*(education|academic background|ausbildung|bildung)\s*:?\s*$/im,
  skills: /^\s*(skills|technical skills|core skills|kenntnisse|fähigkeiten)\s*:?\s*$/im,
};

const ipHash = (deps: TeaserDeps, ip: string) => createHash('sha256').update(`${deps.ipSalt}:${ip}`).digest('hex');

export async function presignTeaser(deps: TeaserDeps, ip: string, input: { fileName: string; contentType: string; size: number }): Promise<PresignResponse> {
  if (!UPLOAD_TYPES.resume.includes(input.contentType)) throw errors.validation({ contentType: 'not allowed' }, 'Upload a PDF, Word (DOCX) or plain-text file.');
  if (input.size > deps.maxBytes) throw new AppError('PAYLOAD_TOO_LARGE', `That file is larger than ${Math.round(deps.maxBytes / 1024 / 1024)} MB.`);
  const hash = ipHash(deps, ip);
  const key = anonymousKey();
  const row = await deps.db.withSystem('teaser: accept an anonymous upload', async (tx) => {
    const recent = await tx
      .selectFrom('anonymous_uploads')
      .select(({ fn }) => fn.countAll<string>().as('n'))
      .where('ip_hash', '=', hash)
      .where('created_at', '>', sql<Date>`now() - interval '1 hour'`)
      .executeTakeFirstOrThrow();
    if (Number(recent.n) >= deps.perIpPerHour) throw errors.rateLimited(3600);
    return tx.insertInto('anonymous_uploads').values({ ip_hash: hash, object_key: key, file_name: input.fileName }).returningAll().executeTakeFirstOrThrow();
  });
  const post = await deps.storage.presignPost({ bucket: deps.anonymousBucket, key, contentType: input.contentType, maxBytes: deps.maxBytes });
  return { upload: { id: row.id, purpose: 'resume', fileName: row.file_name, status: 'pending' }, ...post };
}

async function find(deps: TeaserDeps, id: string): Promise<Row> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw errors.notFound('teaser');
  const row = await deps.db.withSystem('teaser: read an anonymous upload', (tx) => tx.selectFrom('anonymous_uploads').selectAll().where('id', '=', id).executeTakeFirst());
  if (!row) throw errors.notFound('teaser');
  return row;
}

export async function confirmTeaser(deps: TeaserDeps, id: string): Promise<Teaser> {
  const row = await find(deps, id);
  if (row.status !== 'pending') return toTeaser(row);
  if (!(await deps.storage.head(deps.anonymousBucket, row.object_key))) throw errors.conflict('The file has not arrived yet.');
  const updated = await deps.db.withSystem('teaser: queue the scan', async (tx) => {
    const next = await tx.updateTable('anonymous_uploads').set({ status: 'scanning' }).where('id', '=', id).where('status', '=', 'pending').returningAll().executeTakeFirst();
    if (next) await enqueue(tx, { queue: 'generation-standard', groupId: `anon#${id}`, type: 'teaser.process', payload: { teaserId: id }, correlationId: null });
    return next ?? row;
  });
  return toTeaser(updated);
}

export const getTeaser = async (deps: TeaserDeps, id: string) => toTeaser(await find(deps, id));

/** Worker: scan, then analyse in the isolated parser. No model is called for anonymous files. */
export async function processTeaser(deps: TeaserDeps & { scanner: ScanPort; limits?: Partial<IsolationLimits> }, teaserId: string, lastAttempt: boolean): Promise<void> {
  const row = await find(deps, teaserId).catch(() => null);
  if (!row || row.status !== 'scanning') return;
  const set = (values: Record<string, unknown>) => deps.db.withSystem('teaser: record the result', (tx) => tx.updateTable('anonymous_uploads').set(values).where('id', '=', teaserId).execute());
  const bytes = await deps.storage.read(deps.anonymousBucket, row.object_key, deps.maxBytes);
  const verdict = await deps.scanner.scan(bytes);
  if (verdict.verdict === 'failed') {
    if (!lastAttempt) throw new Error(`scan failed: ${verdict.reason}`);
    await set({ status: 'failed' });
    return;
  }
  if (verdict.verdict === 'infected') {
    await deps.storage.remove(deps.anonymousBucket, row.object_key);
    await set({ status: 'infected' });
    return;
  }
  await set({ status: 'analysing' });
  try {
    const analysis = await analyzeIsolated(bytes, { limits: deps.limits });
    const sections = Object.fromEntries(Object.entries(SECTION_HEADINGS).map(([name, pattern]) => [name, pattern.test(analysis.text)]));
    await set({
      status: 'ready',
      findings: JSON.stringify({ kind: analysis.kind, pages: analysis.facts.pages, readable: analysis.facts.chars > 0, ocr: analysis.images.length > 0, characters: analysis.facts.chars, sections, hidden: analysis.hidden }),
    });
  } catch (error) {
    if (!(error instanceof UnreadableError)) throw error;
    await set({ status: 'failed' });
  }
}

/** On sign-up: the teaser's file becomes the user's own clean upload, ready to parse. */
export async function claimTeaser(deps: TeaserDeps, identity: Identity, id: string) {
  const row = await find(deps, id);
  if (row.status !== 'ready') throw errors.conflict('This file is not ready to keep.');
  if (row.claimed_by && row.claimed_by !== identity.userId) throw errors.notFound('teaser');
  const key = userUploadKey(identity.userId);
  await deps.storage.copy({ bucket: deps.anonymousBucket, key: row.object_key }, { bucket: deps.uploadsBucket, key });
  const findings = (row.findings ?? {}) as { kind?: string };
  const upload = await deps.db.withUser(identity, (tx) =>
    tx
      .insertInto('uploads')
      .values({ user_id: identity.userId, purpose: 'resume', bucket: deps.uploadsBucket, object_key: key, file_name: row.file_name, declared_type: 'application/octet-stream', sniffed_type: findings.kind ?? null, status: 'clean', confirmed_at: sql`now()`, scanned_at: sql`now()`, scan_result: JSON.stringify({ verdict: 'clean', from: 'teaser' }) })
      .returningAll()
      .executeTakeFirstOrThrow(),
  );
  await deps.db.withSystem('teaser: mark claimed', (tx) => tx.updateTable('anonymous_uploads').set({ claimed_by: identity.userId }).where('id', '=', id).execute());
  return toUpload(upload);
}

/** The hourly purge: nothing anonymous outlives 24 hours. */
export async function purgeTeasers(deps: Pick<TeaserDeps, 'db' | 'storage' | 'anonymousBucket'>): Promise<number> {
  const old = await deps.db.withSystem('teaser: find uploads past 24 hours', (tx) =>
    tx.selectFrom('anonymous_uploads').select(['id', 'object_key']).where('created_at', '<', sql<Date>`now() - make_interval(hours => ${RETENTION_HOURS})`).limit(1000).execute(),
  );
  for (const row of old) {
    await deps.storage.remove(deps.anonymousBucket, row.object_key).catch(() => {});
    await deps.db.withSystem('teaser: delete an expired upload', (tx) => tx.deleteFrom('anonymous_uploads').where('id', '=', row.id).execute());
  }
  return old.length;
}
