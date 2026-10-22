import type { ResumeContent } from '@nextkin/shared/models';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { groundedModel } from '../../evals/referenceModel';
import type { FakeScript } from '../../src/ai/providers/fake';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { createRunner } from '../../src/pipeline/runner';
import * as content from '../../src/services/resumeContent';
import * as read from '../../src/services/resumeRead';
import { startSectionRun } from '../../src/services/sectionRuns';
import { backendUser, readyJd, runToEnd } from './fixtures/documents';
import { capturingPublisher, deleteUsers, fakeGateway, key, log } from './fixtures/pipeline';

/**
 * "AI rewrite" on the tailor ready screen (toreview §113): a section run with the user's request.
 * The model gets the request as data, and the resume's own lines as its facts, not the profile's.
 * Synthetic (L4).
 */
const config = loadConfig();
let db: Database;
const users: string[] = [];
const as = (userId: string) => ({ userId, role: 'user' as const });

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 4 });
});
afterAll(async () => {
  await deleteUsers(db, users);
  await db.destroy();
});

describe('AI rewrite of one section (toreview §113)', () => {
  it('passes the request to the model with the resume’s own lines as facts', async () => {
    const userId = await backendUser(db, users);
    const jd = await readyJd(db, userId, groundedModel);
    const made = await runToEnd(db, userId, 'resume', { jdId: jd.id, origin: 'build' }, groundedModel);
    const resumeId = made.resumeId!;
    await content.updateSection(db, as(userId), resumeId, 'summary', 'Backend engineer for payment platforms, in my own words.');

    const seen: Record<string, unknown>[] = [];
    const recording: FakeScript = (request, n) => {
      const body = /<input>\n([\s\S]*?)\n<\/input>/.exec(request.messages[0]?.content ?? '')?.[1];
      if (request.output?.name === 'resume' && body) seen.push(JSON.parse(body) as Record<string, unknown>);
      return groundedModel(request, n);
    };
    const run = await startSectionRun(db, as(userId), resumeId, 'summary', { idempotencyKey: key(), correlationId: null, instruction: 'Shorten my summary to remove filler words' });
    const outcome = await createRunner({ db, gateway: fakeGateway(db, recording), publisher: capturingPublisher(), log }).run({ generationId: run.id, userId, correlationId: null, receiveCount: 1 });
    expect(outcome).toBe('completed');

    expect(seen[0]?.instruction).toBe('Shorten my summary to remove filler words');
    // The resume's summary is the fact, not the profile's.
    expect((seen[0]?.profile as { summary?: string }).summary).toBe('Backend engineer for payment platforms, in my own words.');
    const after = (await read.getContent(db, as(userId), resumeId)) as ResumeContent;
    expect(after.summary.length).toBeGreaterThan(0);
  });
});
