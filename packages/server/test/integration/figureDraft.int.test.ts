import { CANONICAL_SCHEMA_VERSION } from '@nextkin/shared/schemas/resumeContent';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { FakeScript } from '../../src/ai/providers/fake';
import { createMemoryKv } from '../../src/cache/kv';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { draftFigure } from '../../src/services/figureDraft';
import { insertVersion } from '../../src/services/versions';
import { createUser, deleteUsers, fakeGateway, log } from './fixtures/pipeline';

/**
 * "Add the result" for an ordinary account, against the real database (toreview §207). Prompts
 * are reference data only staff and the system may read, and the service used to read its prompt
 * as the candidate: it was never found, so every draft fell back to the rules and no test said so,
 * because the unit tests never touched the database. This holds the whole path.
 */
const config = loadConfig();
let db: Database;
const users: string[] = [];

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 4 });
});
afterAll(async () => {
  await deleteUsers(db, users);
  await db.destroy();
});

const LINE = 'Built the seller marketplace where local artisans list handmade products';

async function resumeFor(userId: string): Promise<string> {
  const line = (id: string, text: string) => ({ id, text, evidence: [], origin: 'user' as const });
  const doc = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    headline: 'Full-stack developer',
    summary: line('s', 'Full-stack developer building marketplaces.'),
    skills: [],
    roles: [{ roleId: 'r0', company: 'Lumen Crafts', title: 'Full-stack Developer', start: '2022-03', end: null, skills: [], bullets: [line('b0', LINE)] }],
    education: [],
    certifications: [],
    projects: [],
  };
  return db.withUser({ userId, role: 'user' }, async (tx) => {
    const resume = await tx.insertInto('resumes').values({ user_id: userId, title: 'cv', doc_type: 'resume', source: 'uploaded' }).returning('id').executeTakeFirstOrThrow();
    await insertVersion(tx, { userId, resumeId: resume.id, content: doc, note: 'Uploaded cv.pdf', createdBy: 'upload' });
    return resume.id;
  });
}

/** A model that keeps to the line and offers one typical figure apart from it. */
const fitted: FakeScript = () => ({
  data: {
    before: `${LINE}, onboarding`,
    after: '.',
    hint: 'number of sellers',
    suggestion: '50+ sellers',
    options: [{ what: 'Sellers onboarded', before: `${LINE}, onboarding`, after: '.', amounts: ['50+ sellers', '200+ sellers', '1,000+ sellers'] }],
  },
  text: '',
  stopReason: 'tool_use',
});

describe('"Add the result" for an ordinary account', () => {
  it('reaches the model when the candidate has agreed to AI, and returns its fitted draft', async () => {
    const userId = await createUser(db, users, 'free', { consent: true });
    const resumeId = await resumeFor(userId);
    const draft = await draftFigure({ db, log, ai: { gateway: fakeGateway(db, fitted), cache: createMemoryKv() } }, { userId, role: 'user' }, { resumeId, roleId: 'r0', line: 0 });
    expect(draft).toMatchObject({ by: 'model', hint: 'number of sellers', suggestion: '50+ sellers' });
    expect(draft.options?.[0]).toMatchObject({ what: 'Sellers onboarded', amounts: ['50+ sellers', '200+ sellers', '1,000+ sellers'] });
  });

  it('asks no model without that agreement, and gives the plain line', async () => {
    const userId = await createUser(db, users, 'free', { consent: false });
    const resumeId = await resumeFor(userId);
    let calls = 0;
    const counting: FakeScript = (...args) => {
      calls += 1;
      return fitted(...args);
    };
    const draft = await draftFigure({ db, log, ai: { gateway: fakeGateway(db, counting), cache: createMemoryKv() } }, { userId, role: 'user' }, { resumeId, roleId: 'r0', line: 0 });
    expect(draft).toMatchObject({ by: 'rules', reason: 'no_consent' });
    expect(calls).toBe(0);
  });
});
