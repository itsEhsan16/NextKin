import { expect } from 'vitest';

import type { FakeScript } from '../../../src/ai/providers/fake';
import { createMemoryKv } from '../../../src/cache/kv';
import type { Database } from '../../../src/db/database';
import type { LatexCompiler } from '../../../src/export/latex/compile';
import { createRunner, type RunnerHooks } from '../../../src/pipeline/runner';
import * as generations from '../../../src/services/generations';
import { createJd, getJd, runJdExtract } from '../../../src/services/jd';
import { capturingPublisher, createUser, fakeGateway, key, log } from './pipeline';

/**
 * Documents for the generation and library suites (P9, P10): a profile with dated roles, a ready
 * JD, and a run driven to the end with a scripted model.
 */

export const JD_TEXT = [
  'Senior Backend Engineer at Acme Payments',
  'We build reliable payment services for merchants across Europe.',
  'Requirements: strong Go and PostgreSQL skills, and experience running Kubernetes in production.',
  'Nice to have: Terraform and Redis.',
  'You will own services end to end and work closely with product.',
].join('\n');

/** A user whose profile has two dated roles with facts and skill tags. */
export async function backendUser(db: Database, users: string[]): Promise<string> {
  const userId = await createUser(db, users);
  await backendProfile(db, userId);
  return userId;
}

/** The same profile, on a user that already exists (one signed in through the harness). */
export async function backendProfile(db: Database, userId: string): Promise<void> {
  await db.withUser({ userId, role: 'user' }, async (tx) => {
    await tx.updateTable('profiles').set({ headline: 'Backend engineer', bio: 'Backend engineer working on payment systems.', location: 'Berlin' }).where('user_id', '=', userId).execute();
    const pay = await tx
      .insertInto('experience')
      .values({ user_id: userId, company: 'Lumen Pay', title: 'Senior Backend Engineer', start_date: '2020-03-01', is_current: true, description: 'Owns the settlement platform.', responsibilities: ['Built the settlement service in Go, processing 2 million transactions daily', 'Reduced ledger API p99 latency from 800 ms to 440 ms by reworking PostgreSQL indexes', 'Moved 40 services onto Kubernetes with zero downtime'] })
      .returning('id')
      .executeTakeFirstOrThrow();
    const shop = await tx
      .insertInto('experience')
      .values({ user_id: userId, company: 'Cartwheel', title: 'Backend Developer', start_date: '2009-01-01', end_date: '2012-06-01', end_precision: 'month', description: 'Order services for an online shop.', responsibilities: ['Developed order APIs in Python for 300 merchants', 'Kept the CRM sync running for the sales team'] })
      .returning('id')
      .executeTakeFirstOrThrow();
    for (const [id, skills] of [[pay.id, ['Go', 'PostgreSQL', 'Kubernetes']], [shop.id, ['Python', 'PostgreSQL', 'Kubernetes']]] as const) {
      for (const raw of skills) await tx.insertInto('experience_skills').values({ user_id: userId, experience_id: id, raw_name: raw }).execute();
    }
    for (const raw of ['Go', 'PostgreSQL', 'Kubernetes', 'Python']) await tx.insertInto('profile_skills').values({ user_id: userId, raw_name: raw }).execute();
    await tx.insertInto('education').values({ user_id: userId, institution: 'TU Example', degree: 'BSc Computer Science' }).execute();
  });
}

/** Counts model calls per schema, around a scripted model. */
export function counted(script: FakeScript) {
  const calls: Record<string, number> = {};
  const wrapped: FakeScript = (request, n) => {
    const name = request.output?.name ?? 'text';
    calls[name] = (calls[name] ?? 0) + 1;
    return script(request, n);
  };
  return { script: wrapped, calls };
}

export async function readyJd(db: Database, userId: string, script: FakeScript, cache = createMemoryKv()) {
  const draft = await createJd(db, { userId, role: 'user' }, { source: 'paste', text: JD_TEXT }, null);
  expect(draft.status).toBe('extracting');
  await runJdExtract({ db, gateway: fakeGateway(db, script), cache, log }, { jdId: draft.id, userId, correlationId: null }, false);
  return getJd(db, { userId, role: 'user' }, draft.id);
}

export async function runToEnd(db: Database, userId: string, kind: 'resume' | 'zero_resume' | 'cover_letter' | 'ats_check' | 'interview', input: Record<string, unknown>, script: FakeScript, hooks?: RunnerHooks, extra: { latex?: LatexCompiler } = {}) {
  const { generation } = await generations.startGeneration(db, { userId, role: 'user' }, { kind, ...input }, { idempotencyKey: key(), correlationId: null });
  const runner = createRunner({ db, gateway: fakeGateway(db, script), publisher: capturingPublisher(), log, ...extra }, hooks);
  const message = { generationId: generation.id, userId, correlationId: null, receiveCount: 1 };
  let outcome = await runner.run(message).catch((e: unknown) => e);
  if (outcome instanceof Error && hooks) outcome = await createRunner({ db, gateway: fakeGateway(db, script), publisher: capturingPublisher(), log }).run({ ...message, receiveCount: 2 });
  return { generationId: generation.id, outcome, resumeId: generation.resumeId };
}
