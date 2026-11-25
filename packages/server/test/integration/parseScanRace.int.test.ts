import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import type { ScanPort } from '../../src/scan/scan';
import { startParse, sweepStuckParses } from '../../src/services/resumeParse';
import { scanUpload, type UploadDeps } from '../../src/services/uploads';
import type { StoragePort } from '../../src/storage/storage';
import { makeDocx } from '../fixtures/makeDocx';
import { createUser, deleteUsers } from './fixtures/pipeline';

/**
 * A resume read asked for at the moment its scan finishes (owner, 2026-11-25). On the demo, two
 * uploads in seven hung: the parse was stored as waiting for a scan that had already finished, and
 * nothing ever started it. The browser asks for the read the instant the upload is confirmed, and a
 * scan takes under a second, so the two run together. Postgres only; storage and scanner are stand-ins.
 */
const config = loadConfig();
let db: Database;
const users: string[] = [];
const bytes = makeDocx([[{ text: 'Jordan Avery' }], [{ text: 'Experience' }]]);
const storage = { read: async () => bytes } as unknown as StoragePort;
const scanner: ScanPort = { scan: async () => ({ verdict: 'clean' }) } as unknown as ScanPort;
const deps = (): UploadDeps & { scanner: ScanPort } => ({ db, storage, bucket: 'test', limits: { documentBytes: 10_000_000, avatarBytes: 1_000_000 }, scanner });
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function scanningUpload(userId: string): Promise<string> {
  const row = await db.withUser({ userId, role: 'user' }, (tx) =>
    tx
      .insertInto('uploads')
      .values({ user_id: userId, purpose: 'resume', bucket: 'test', object_key: `users/${userId}/${crypto.randomUUID()}`, file_name: 'resume.docx', declared_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', status: 'scanning' })
      .returning('id')
      .executeTakeFirstOrThrow(),
  );
  return row.id;
}

const parseStatus = (userId: string, id: string) => db.withUser({ userId, role: 'user' }, async (tx) => (await tx.selectFrom('resume_parses').select('status').where('id', '=', id).executeTakeFirstOrThrow()).status);

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 8 });
});
afterAll(async () => {
  await deleteUsers(db, users);
  await db.destroy();
});

describe('a read asked for while its scan finishes', () => {
  it('is never left waiting for a scan that is already done', async () => {
    const userId = await createUser(db, users);
    const identity = { userId, role: 'user' as const };
    const stuck: number[] = [];
    for (let n = 0; n < 60; n += 1) {
      const uploadId = await scanningUpload(userId);
      // The two meet at every offset a real request can: the read asked just before, with, or
      // just after the scan's verdict is written.
      const [, parse] = await Promise.all([
        pause(n % 4).then(() => scanUpload(deps(), { uploadId, userId }, false)),
        pause((n * 7) % 5).then(() => startParse(db, identity, uploadId, null)),
      ]);
      if ((await parseStatus(userId, parse.id)) === 'waiting_scan') stuck.push(n);
    }
    expect(stuck).toEqual([]);
  }, 120_000);
});

describe('a read found waiting when the sweep runs', () => {
  it('is started when its upload is clean, failed when the upload was refused, and timed out when the scan never came', async () => {
    const userId = await createUser(db, users);
    const identity = { userId, role: 'user' as const };
    const waiting = async (uploadStatus: 'clean' | 'failed' | 'scanning', ageSeconds: number) => {
      const uploadId = await scanningUpload(userId);
      return db.withUser(identity, async (tx) => {
        await tx.updateTable('uploads').set({ status: uploadStatus }).where('id', '=', uploadId).execute();
        const row = await tx
          .insertInto('resume_parses')
          .values({ user_id: userId, upload_id: uploadId, status: 'waiting_scan', created_at: sql`now() - make_interval(secs => ${ageSeconds})` })
          .returning('id')
          .executeTakeFirstOrThrow();
        return row.id;
      });
    };
    const clean = await waiting('clean', 5);
    const refused = await waiting('failed', 5);
    const fresh = await waiting('scanning', 5);
    const old = await waiting('scanning', 900);

    await sweepStuckParses(db, 600, 300);
    expect(await parseStatus(userId, clean)).toBe('queued');
    expect(await parseStatus(userId, refused)).toBe('failed');
    // A scan still inside its time is left alone; one long past it is given up on.
    expect(await parseStatus(userId, fresh)).toBe('waiting_scan');
    expect(await parseStatus(userId, old)).toBe('failed');
    const queued = await db.withSystem('test: outbox rows for the released parse', (tx) => tx.selectFrom('outbox').select('payload').orderBy('id', 'desc').limit(200).execute());
    expect(queued.filter((m) => (m.payload as { type?: string; payload?: { parseId?: string } }).type === 'resume.parse' && (m.payload as { payload?: { parseId?: string } }).payload?.parseId === clean)).toHaveLength(1);
  }, 60_000);
});
