import { phraseKey } from '@nextkin/engines/text';
import { z } from 'zod';

import type { AiGateway } from '../ai/gateway';
import type { Database } from '../db/database';
import type { Logger } from '../observability/logger';
import { activePrompt } from './prompts';

/**
 * KB seed tooling (ImBackendImplementationPlan P9-07, old M2-11; V2 §7.7). Technologies the timeline
 * engine could not verify wait in `kb_review_queue`, most-seen first. This job asks the fast tier for
 * a candidate entry per name, with a cited source, and files it as `llm_seeded`: a candidate a
 * curator reviews (P12), never an entry that can hard-fail (§7.7). A name the model says is not a
 * technology, or an answer with impossible years or no source, is marked and not filed.
 *
 * Calls go one by one through the gateway, so they are traced and capped; the Message Batches API is
 * not used yet [verify its availability on the production route].
 */

export const KB_TEMPLATE = 'kb.candidate';
const CATEGORIES = ['language', 'framework', 'library', 'database', 'cloud', 'devops', 'tool'] as const;

export const candidateSchema = z.object({
  isTechnology: z.boolean(),
  canonicalName: z.string().trim().min(1).max(120),
  category: z.enum(CATEGORIES),
  aliases: z.array(z.string().trim().min(1).max(80)).max(10),
  releaseYear: z.number().int().min(1940).max(2100).nullable(),
  safeUsageYear: z.number().int().min(1940).max(2100).nullable(),
  enterpriseAdoptionYear: z.number().int().min(1940).max(2100).nullable(),
  /** Where the release year can be checked: Wikidata or the project's own history. */
  sourceUrl: z.string().trim().max(500).nullable(),
});

const slugOf = (name: string) => phraseKey(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'technology';

export async function runKbCandidates(deps: { db: Database; gateway: AiGateway; log: Logger; batch?: number }): Promise<number> {
  const pending = await deps.db.withSystem('kb: read the review queue', (tx) =>
    tx.selectFrom('kb_review_queue').select(['name_key', 'name']).where('status', '=', 'pending').orderBy('occurrences', 'desc').limit(deps.batch ?? 10).execute(),
  );
  if (pending.length === 0) return 0;
  const prompt = await deps.db.withSystem('kb: read the candidate prompt', (tx) => activePrompt(tx, KB_TEMPLATE));
  let filed = 0;
  for (const item of pending) {
    const mark = (status: 'seeded' | 'not_technology' | 'failed', technologyId: string | null = null) =>
      deps.db.withSystem('kb: mark a queue item', (tx) =>
        tx.updateTable('kb_review_queue').set({ status, technology_id: technologyId, processed_at: new Date() }).where('name_key', '=', item.name_key).execute(),
      );
    try {
      const { data } = await deps.gateway.extract({
        stage: 'kb_candidates',
        system: prompt.body.system.map((text) => ({ text })),
        input: { name: item.name },
        schema: candidateSchema,
        name: 'technology',
        description: 'A candidate Technology Knowledge Base entry, with a source for its release year.',
        context: { tag: 'product', promptVersionId: prompt.id },
      });
      if (!data.isTechnology) {
        await mark('not_technology');
        continue;
      }
      const ordered = data.releaseYear !== null && data.safeUsageYear !== null && data.enterpriseAdoptionYear !== null && data.releaseYear <= data.safeUsageYear && data.safeUsageYear <= data.enterpriseAdoptionYear;
      if (!ordered || !data.sourceUrl || !/^https:\/\//.test(data.sourceUrl)) {
        await mark('failed');
        continue;
      }
      const technologyId = await deps.db.withSystem('kb: file a machine-seeded candidate', async (tx) => {
        const row = await tx
          .insertInto('technologies')
          .values({
            name: data.canonicalName,
            slug: slugOf(data.canonicalName),
            category: data.category,
            aliases: data.aliases,
            release_year: data.releaseYear,
            safe_usage_year: data.safeUsageYear,
            enterprise_adoption_year: data.enterpriseAdoptionYear,
            review_status: 'llm_seeded',
            source_citation: data.sourceUrl,
            dataset_version: 1,
          })
          .onConflict((oc) => oc.column('slug').doNothing())
          .returning('id')
          .executeTakeFirst();
        return row?.id ?? null;
      });
      await mark('seeded', technologyId);
      filed += 1;
    } catch (error) {
      deps.log.warn({ event: 'kb.candidate_failed', errorName: error instanceof Error ? error.name : typeof error }, 'kb candidate failed');
      await mark('failed');
    }
  }
  deps.log.info({ event: 'kb.candidates', seen: pending.length, filed }, 'kb candidates filed');
  return filed;
}
