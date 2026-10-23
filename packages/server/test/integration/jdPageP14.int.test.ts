import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { groundedModel } from '../../evals/referenceModel';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { getJd, updateJd } from '../../src/services/jd';
import { jdMatch } from '../../src/services/jdMatch';
import { backendUser, readyJd } from './fixtures/documents';
import { createUser, deleteUsers } from './fixtures/pipeline';

/**
 * A job description's own page (toreview §110): its match card comes from the listing match
 * engine, with its basis; and a JD whose reading failed becomes usable once the user enters its
 * fields by hand (V2 §7.5).
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

describe('the JD page (P14)', () => {
  it('matches the profile against the JD with the listing engine, and says on what basis', async () => {
    const userId = await backendUser(db, users);
    const identity = { userId, role: 'user' as const };
    const jd = await readyJd(db, userId, groundedModel);
    const match = await jdMatch(db, identity, jd.id);
    expect(match.matchBasis).toMatchObject({ method: 'jobmatch-1' });
    expect(match.matchBasis!.requiredTotal).toBeGreaterThan(0);
    expect(match.matchBand).toBeDefined();
    // The criteria are the ledger behind the basis: as many met as it counts, and some are.
    const met = (match.matchCriteria ?? []).filter((c) => c.state === 'met');
    expect(met.length).toBe(match.matchBasis!.requiredMet + match.matchBasis!.preferredMet);
    expect(met.length).toBeGreaterThan(0);
  }, 60_000);

  it('has nothing to score for an empty profile', async () => {
    const userId = await createUser(db, users);
    const jd = await readyJd(db, userId, groundedModel);
    expect(await jdMatch(db, { userId, role: 'user' }, jd.id)).toEqual({});
  }, 60_000);

  it('makes a failed reading usable once its fields are entered by hand', async () => {
    const userId = await createUser(db, users);
    const identity = { userId, role: 'user' as const };
    const row = await db.withUser(identity, (tx) =>
      tx
        .insertInto('job_descriptions')
        .values({ user_id: userId, source: 'paste', raw_text: 'Lunch menu: soup, bread, coffee.', status: 'failed', error_message: 'Not a job description.', content_hash: 'p14-manual' })
        .returning('id')
        .executeTakeFirstOrThrow(),
    );
    // A title alone is not enough to match against.
    expect((await updateJd(db, identity, row.id, { title: 'Backend Engineer' })).status).toBe('failed');
    const done = await updateJd(db, identity, row.id, { requiredSkills: ['Go', 'PostgreSQL'], responsibilities: ['Build payment services'] });
    expect(done).toMatchObject({ status: 'ready', title: 'Backend Engineer', requiredSkills: ['Go', 'PostgreSQL'] });
    expect(done.error).toBeUndefined();
    expect((await getJd(db, identity, row.id)).requirements?.length).toBeGreaterThan(0);
  });
});
