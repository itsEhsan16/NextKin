import { z } from 'zod';
import type { Database, Identity, Tx } from '../db/database';

/**
 * Prompts as data (ImBackendImplementationPlan P6-11, spec §12.3, G12). A template has numbered,
 * immutable versions that move `draft → staged → active`; exactly one is active (a unique index
 * holds that), and activating another archives the previous one, which is also the one-step
 * rollback. Every run records the version id it used, so an output can be reproduced from its
 * recorded versions. Publishing a version will require a passing eval run (P9, M2-22); the admin UI
 * is P12.
 */

export const promptBodySchema = z.object({ system: z.array(z.string().min(1)).min(1) });
export type PromptBody = z.infer<typeof promptBodySchema>;

export interface PromptVersion {
  id: string;
  templateId: string;
  version: number;
  body: PromptBody;
}

const toVersion = (row: { id: string; prompt_template_id: string; version: number; body: unknown }): PromptVersion => ({
  id: row.id,
  templateId: row.prompt_template_id,
  version: row.version,
  body: promptBodySchema.parse(row.body),
});

/** The active version of a template, read inside the caller's transaction. */
export async function activePrompt(tx: Tx, templateName: string): Promise<PromptVersion> {
  const row = await tx
    .selectFrom('prompt_template_versions as v')
    .innerJoin('prompt_templates as t', 't.id', 'v.prompt_template_id')
    .select(['v.id', 'v.prompt_template_id', 'v.version', 'v.body'])
    .where('t.name', '=', templateName)
    .where('v.status', '=', 'active')
    .executeTakeFirst();
  if (!row) throw new Error(`prompt template "${templateName}" has no active version; run pnpm seed`);
  return toVersion(row);
}

/** A specific version, for reproducing a recorded run. */
export async function promptVersion(tx: Tx, id: string): Promise<PromptVersion> {
  return toVersion(await tx.selectFrom('prompt_template_versions').select(['id', 'prompt_template_id', 'version', 'body']).where('id', '=', id).executeTakeFirstOrThrow());
}

/**
 * Prompt changes, made as a named admin or curator (RLS allows staff writes only), so every change
 * is attributable. The Admin Portal (P12) calls this; so do tests.
 */
export function createPromptAdmin(db: Database, actor: Identity) {
  if (actor.role !== 'admin' && actor.role !== 'curator') throw new Error('only an admin or curator can change prompts');
  const run = <T>(_purpose: string, fn: (tx: Tx) => Promise<T>) => db.withUser(actor, fn);
  return {
    async draft(templateName: string, body: PromptBody): Promise<PromptVersion> {
      const parsed = promptBodySchema.parse(body);
      return run('draft a version', async (tx) => {
        const template = await tx.selectFrom('prompt_templates').select('id').where('name', '=', templateName).executeTakeFirstOrThrow();
        const latest = await tx.selectFrom('prompt_template_versions').select(({ fn }) => fn.max('version').as('max')).where('prompt_template_id', '=', template.id).executeTakeFirst();
        const row = await tx
          .insertInto('prompt_template_versions')
          .values({ prompt_template_id: template.id, version: Number(latest?.max ?? 0) + 1, body: JSON.stringify(parsed), status: 'draft', created_by: actor.userId })
          .returning(['id', 'prompt_template_id', 'version', 'body'])
          .executeTakeFirstOrThrow();
        return toVersion(row);
      });
    },

    async stage(versionId: string): Promise<void> {
      await run('stage a version', async (tx) => {
        const updated = await tx.updateTable('prompt_template_versions').set({ status: 'staged' }).where('id', '=', versionId).where('status', '=', 'draft').executeTakeFirst();
        if (Number(updated.numUpdatedRows) !== 1) throw new Error('only a draft can be staged');
      });
    },

    /** Makes a staged (or archived, for rollback) version the active one; the old active is archived. */
    async activate(versionId: string): Promise<void> {
      await run('activate a version', async (tx) => {
        const target = await tx.selectFrom('prompt_template_versions').select(['prompt_template_id', 'status']).where('id', '=', versionId).forUpdate().executeTakeFirstOrThrow();
        if (target.status !== 'staged' && target.status !== 'archived') throw new Error('only a staged or archived version can be activated');
        await tx.updateTable('prompt_template_versions').set({ status: 'archived' }).where('prompt_template_id', '=', target.prompt_template_id).where('status', '=', 'active').execute();
        await tx.updateTable('prompt_template_versions').set({ status: 'active' }).where('id', '=', versionId).execute();
      });
    },

    /** One step back: the most recently archived version becomes active again. */
    async rollback(templateName: string): Promise<PromptVersion> {
      const previous = await run('find the version to roll back to', (tx) =>
        tx
          .selectFrom('prompt_template_versions as v')
          .innerJoin('prompt_templates as t', 't.id', 'v.prompt_template_id')
          .select(['v.id'])
          .where('t.name', '=', templateName)
          .where('v.status', '=', 'archived')
          .orderBy('v.version', 'desc')
          .executeTakeFirst(),
      );
      if (!previous) throw new Error('there is no earlier version to roll back to');
      await this.activate(previous.id);
      return run('read the active version', (tx) => activePrompt(tx, templateName));
    },
  };
}
