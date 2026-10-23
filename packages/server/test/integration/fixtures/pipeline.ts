import { AI_PROVIDER_LIST } from '@nextkin/shared/models/consent';
import { randomUUID } from 'node:crypto';
import type { AiGateway } from '../../../src/ai/gateway';
import { createAiGateway } from '../../../src/ai/gateway';
import { createFakeProvider, type FakeScript } from '../../../src/ai/providers/fake';
import { createAiSettings } from '../../../src/ai/routing';
import { createDbTrace } from '../../../src/ai/trace';
import type { Database } from '../../../src/db/database';
import { createLogger } from '../../../src/observability/logger';
import type { EventPublisher, PublishedEvent } from '../../../src/pipeline/events';

/** Shared pieces for the async-backbone integration suites (P6). */

export const log = createLogger('silent', 'test');

/** Moves an existing test user onto Pro (an active monthly subscription). */
export async function grantPro(db: Database, userId: string): Promise<void> {
  await db.withUser({ userId, role: 'user' }, async (tx) => {
    const account = await tx.insertInto('billing_accounts').values({ owner_user_id: userId }).onConflict((oc) => oc.column('owner_user_id').doUpdateSet({ updated_at: new Date() })).returning('id').executeTakeFirstOrThrow();
    await tx.insertInto('subscriptions').values({ billing_account_id: account.id, user_id: userId, plan_id: 'pro_monthly', status: 'active' }).execute();
  });
}

/** A user row with no identity behind it: enough for generations, events and quotas. */
export async function createUser(db: Database, created: string[], plan: 'free' | 'pro' = 'free', options: { consent?: boolean } = {}): Promise<string> {
  const userId = randomUUID();
  await db.withUser({ userId, role: 'user' }, async (tx) => {
    await tx.insertInto('users').values({ id: userId, identity_sub: `p6test|${userId}`, email: `p6-${userId}@example.test` }).execute();
    await tx.insertInto('profiles').values({ user_id: userId }).execute();
    // The suites act as users who agreed to the AI providers (P12-12); the consent suite opts out.
    if (options.consent !== false) await tx.insertInto('consents').values({ user_id: userId, kind: 'ai_processing', document_version: AI_PROVIDER_LIST.version }).execute();
    if (plan === 'pro') {
      const account = await tx.insertInto('billing_accounts').values({ owner_user_id: userId }).returning('id').executeTakeFirstOrThrow();
      await tx.insertInto('subscriptions').values({ billing_account_id: account.id, user_id: userId, plan_id: 'pro_monthly', status: 'active' }).execute();
    }
  });
  created.push(userId);
  return userId;
}

export async function deleteUsers(db: Database, ids: string[]): Promise<void> {
  if (ids.length) await db.withSystem('p6 suite cleanup', (tx) => tx.deleteFrom('users').where('id', 'in', ids).execute());
}

/** The real routing and trace, with a fake provider standing in for Claude. */
export function fakeGateway(db: Database, script?: FakeScript): AiGateway {
  const fake = createFakeProvider({ script });
  return createAiGateway({
    settings: createAiSettings(db, 0),
    providers: { resolve: (family) => (family === 'claude' ? fake : null), isDeveloperKey: () => false },
    trace: createDbTrace(db, log),
    log,
    developer: 'test',
    dailyCapUsd: 0,
    retryDelayMs: () => 0,
  });
}

export function capturingPublisher(): EventPublisher & { events: { generationId: string; event: PublishedEvent }[] } {
  const events: { generationId: string; event: PublishedEvent }[] = [];
  return {
    events,
    async publish(generationId, event) {
      events.push({ generationId, event });
    },
  };
}

export const key = () => `idem-${randomUUID()}`;
