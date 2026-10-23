import { randomUUID } from 'node:crypto';

import { AI_PROVIDER_LIST } from '@nextkin/shared/models/consent';
import JSZip from 'jszip';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { groundedModel } from '../../evals/referenceModel';
import { createStandInBrain } from '../../src/assistant/brain';
import { loadConfig } from '../../src/config';
import { createRunner } from '../../src/pipeline/runner';
import * as assistant from '../../src/services/assistant';
import * as consent from '../../src/services/consent';
import * as generations from '../../src/services/generations';
import { createJd } from '../../src/services/jd';
import { buildDataExport, getDataExport, ownedTables, purgeDeletedAccounts, requestDataExport } from '../../src/services/privacy';
import { buildStorage } from '../../src/storage/build';
import { backendProfile, runToEnd } from './fixtures/documents';
import { capturingPublisher, createUser, deleteUsers, fakeGateway, log } from './fixtures/pipeline';
import { mobileLogin, PASSWORD, registered, startHarness, type Harness } from './fixtures/authHarness';

/**
 * Consent and data rights against Postgres and storage (ImBackendImplementationPlan P12-11,
 * P12-12): no AI work without consent to the current provider list, checked at every entry point
 * and again by the runner; an export that covers every table holding the user's data; and a
 * deletion that ends every session at once and leaves nothing after the purge.
 */
const config = loadConfig();
const storage = buildStorage(config);
let h: Harness;
const users: string[] = [];

beforeAll(async () => {
  h = await startHarness({});
});
afterAll(async () => {
  await deleteUsers(h.db, users);
  await h.close();
});

const start = (userId: string) => generations.startGeneration(h.db, { userId, role: 'user' }, { kind: 'resume' }, { idempotencyKey: randomUUID(), correlationId: null });

describe('AI consent (P12-12)', () => {
  it('no AI entry point works without consent to the current provider list', async () => {
    const userId = await createUser(h.db, users, 'free', { consent: false });
    const identity = { userId, role: 'user' as const };
    await expect(start(userId)).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    await expect(createJd(h.db, identity, { source: 'paste', text: 'Backend engineer, Go and PostgreSQL.' }, null)).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    await expect(assistant.sendMessage({ db: h.db, brain: createStandInBrain(), log }, identity, { text: 'Why is my ATS score low?' })).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    // Refused before it counted: the daily meter is untouched.
    const meter = await h.db.withUser(identity, (tx) => tx.selectFrom('usage_counters').select('used').where('metric', '=', 'assistant_message').executeTakeFirst());
    expect(meter).toBeUndefined();

    const before = await consent.getAiConsent(h.db, identity);
    expect(before).toMatchObject({ granted: false, current: { version: AI_PROVIDER_LIST.version } });
    expect(before.current.providers.map((p) => p.name)).toEqual(['Anthropic']);
    await expect(consent.grantAiConsent(h.db, identity, 'providers-v0')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await consent.grantAiConsent(h.db, identity, AI_PROVIDER_LIST.version)).granted).toBe(true);
    await expect(start(userId)).resolves.toBeTruthy();
  });

  it('the runner refuses a queued run whose owner withdrew consent', async () => {
    const userId = await createUser(h.db, users, 'pro');
    const { generation } = await start(userId);
    await consent.withdrawAiConsent(h.db, { userId, role: 'user' });
    const runner = createRunner({ db: h.db, gateway: fakeGateway(h.db, groundedModel), publisher: capturingPublisher(), log });
    expect(await runner.run({ generationId: generation.id, userId, correlationId: null, receiveCount: 1 })).toBe('failed');
    const row = await h.db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('generations').select(['status', 'error_code', 'quota_released_at']).where('id', '=', generation.id).executeTakeFirstOrThrow());
    expect(row).toMatchObject({ status: 'failed', error_code: 'consent_required' });
    expect(row.quota_released_at).not.toBeNull();
  });
});

describe('the data export (P12-11)', () => {
  it('covers every table holding the user’s data, with their files, behind a short-lived link', async () => {
    const userId = await createUser(h.db, users);
    const identity = { userId, role: 'user' as const };
    await backendProfile(h.db, userId);
    await runToEnd(h.db, userId, 'resume', { origin: 'build' }, groundedModel);
    const deps = { db: h.db, storage, exportsBucket: config.S3_BUCKET_EXPORTS, uploadsBucket: config.S3_BUCKET_UPLOADS, log };

    const asked = await requestDataExport(deps, identity, null);
    expect(asked.status).toBe('preparing');
    expect((await requestDataExport(deps, identity, null)).requestedAt).toBe(asked.requestedAt); // not started twice
    const row = await h.db.withUser(identity, (tx) => tx.selectFrom('data_exports').select('id').executeTakeFirstOrThrow());
    expect(await buildDataExport(deps, { exportId: row.id, userId })).toBe('built');

    const ready = await getDataExport(deps, identity);
    expect(ready).toMatchObject({ status: 'ready', fileName: 'nextkin-export.zip' });
    expect(ready.url).toMatch(/X-Amz-Expires=900/);
    const key = `users/${userId}/data-exports/${row.id}.zip`;
    const zip = await JSZip.loadAsync(await storage.read(config.S3_BUCKET_EXPORTS, key, 50 * 1024 * 1024));
    const data = JSON.parse(await zip.file('data.json')!.async('string')) as { tables: Record<string, unknown[]> };
    // Every table the catalog says holds this user's data is in the archive.
    const expected = (await ownedTables(h.db, identity)).map((t) => t.table).sort();
    expect(Object.keys(data.tables).sort()).toEqual(expected);
    expect(expected).toEqual(expect.arrayContaining(['users', 'profiles', 'experience', 'resumes', 'resume_versions', 'ats_reports', 'generations', 'consents', 'usage_counters', 'chat_messages', 'saved_jobs', 'interview_question_sets', 'shared_reports', 'data_exports']));
    expect(data.tables.experience).toHaveLength(2);
    expect(data.tables.resumes!.length).toBeGreaterThan(0);
  }, 90_000);
});

describe('account deletion (P12-11)', () => {
  it('ends every session now, releases the email, and the purge leaves nothing', async () => {
    const email = await registered(h);
    const { accessToken } = await mobileLogin(h, email);
    const headers = { authorization: `Bearer ${accessToken}`, 'x-nextkin-client': 'mobile' };
    const user = await h.db.withSystem('test: find the user', (tx) => tx.selectFrom('users').select('id').where('email', '=', email).executeTakeFirstOrThrow());
    await backendProfile(h.db, user.id);

    expect((await h.app.request('/api/v1/me', { method: 'DELETE', headers })).status).toBe(204);
    expect((await h.app.request('/api/v1/me', { headers })).status).toBe(401);
    const login = await h.app.request('/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, client: 'mobile' }) });
    expect(login.status).not.toBe(200);
    const marked = await h.db.withSystem('test: read the deleted user', (tx) => tx.selectFrom('users').select(['status', 'email']).where('id', '=', user.id).executeTakeFirstOrThrow());
    expect(marked.status).toBe('deleted');
    expect(marked.email).not.toBe(email);

    expect(await purgeDeletedAccounts({ db: h.db, storage, exportsBucket: config.S3_BUCKET_EXPORTS, uploadsBucket: config.S3_BUCKET_UPLOADS, log })).toBeGreaterThanOrEqual(1);
    const left = await h.db.withSystem('test: count what is left', async (tx) => {
      const tables = await sql<{ table: string }>`select table_name as table from information_schema.columns where table_schema = 'app' and column_name = 'user_id'`.execute(tx);
      const found: string[] = [];
      for (const { table } of tables.rows) {
        const n = await sql<{ n: number }>`select count(*)::int as n from ${sql.table(`app.${table}`)} where user_id = ${user.id}`.execute(tx);
        if (n.rows[0]!.n > 0) found.push(table);
      }
      return found;
    });
    expect(left).toEqual([]);
    // The address can sign up again.
    expect(await registered(h, email)).toBe(email);
  }, 60_000);
});
