import { createHash } from 'node:crypto';

import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { mentionsIn } from '@nextkin/engines/normalizer';
import { numbersIn } from '@nextkin/engines/numbers';
import { phraseKey } from '@nextkin/engines/text';
import { fallbackFigureDraft, type FigureDraft } from '@nextkin/shared/models/tailor';
import { z } from 'zod';

import type { AiGateway } from '../ai/gateway';
import type { KvCache } from '../cache/kv';
import type { Database, Identity } from '../db/database';
import { errors } from '../http/errors';
import type { Logger } from '../observability/logger';
import { hasAiConsent } from './consent';
import { activePrompt } from './prompts';
import { readBase } from './tailorBase';

/**
 * "Add the result", drafted (toreview §129, owner 2026-10-22). The AI rewrites one bullet so a
 * measured result fits it, leaving a gap where the figure goes: "Built the checkout in React,
 * cutting page load by" + [the user's figure] + ".". The user types only the figure. The model
 * never writes one (G13), and code checks that it didn't (G14):
 * - no number the line didn't already state;
 * - no technology the line didn't already name;
 * - most of the line's own words kept, so it still says what the user did.
 * A draft that fails, or no model at all, falls back to the line as written with "improving" and the
 * gap after it. Only the line and its role's title reach the model, never contact details (G5).
 */

export const FIGURE_TEMPLATE = 'figure.draft';
const CACHE_SECONDS = 30 * 24 * 3600;
const MAX_LENGTH = 300;

export const figureDraftSchema = z.object({
  before: z.string().trim().min(1).max(MAX_LENGTH),
  after: z.string().max(120),
  hint: z.string().trim().min(1).max(80),
});

/** The line as written, the gap after "improving": what is shown when the model can't help. */
export const fallbackDraft = fallbackFigureDraft;

const contentWords = (text: string) => phraseKey(text).split(' ').filter((w) => w.length >= 4);

/** Whether a draft keeps to the line: no new number, no new technology, most of its words. */
export function keepsToLine(line: string, draft: { before: string; after: string }): boolean {
  const text = `${draft.before} ${draft.after}`;
  if (text.length > MAX_LENGTH) return false;
  const numbers = new Set(numbersIn(line, TAXONOMY).map((n) => n.value));
  if (numbersIn(text, TAXONOMY).some((n) => !numbers.has(n.value))) return false;
  const named = new Set(mentionsIn(TAXONOMY, line).map((m) => m.skillId));
  if (mentionsIn(TAXONOMY, text).some((m) => !named.has(m.skillId))) return false;
  const own = contentWords(line);
  const kept = new Set(contentWords(text));
  return own.length === 0 || own.filter((w) => kept.has(w)).length / own.length >= 0.6;
}

export interface FigureDraftDeps {
  db: Database;
  log: Logger;
  /** Absent without a live model route: the rules' draft is used. */
  ai?: { gateway: AiGateway; cache: KvCache };
}

export async function draftFigure(deps: FigureDraftDeps, identity: Identity, request: { resumeId: string; roleId: string; line: number }): Promise<FigureDraft> {
  const found = await deps.db.withUser(identity, async (tx) => {
    const base = await readBase(tx, identity.userId, request.resumeId);
    const role = base.doc.roles.find((r) => r.roleId === request.roleId);
    const bullet = role?.bullets[request.line];
    if (!role || !bullet) throw errors.notFound('bullet');
    // Without AI consent (P12-12) no model is asked: the rules' draft is the answer.
    const allowed = deps.ai ? await hasAiConsent(tx, identity.userId) : false;
    const prompt = allowed ? await activePrompt(tx, FIGURE_TEMPLATE).catch(() => null) : null;
    return { line: bullet.text, title: role.title, prompt };
  });
  const fallback = fallbackDraft(found.line);
  if (!deps.ai || !found.prompt) return fallback;

  const key = `fig:${found.prompt.id}:${createHash('sha256').update(`${found.title}\n${found.line}`).digest('hex')}`;
  try {
    let data = await deps.ai.cache.get<z.infer<typeof figureDraftSchema>>(key);
    if (!data) {
      ({ data } = await deps.ai.gateway.extract({
        stage: 'figure_draft',
        system: found.prompt.body.system.map((text) => ({ text })),
        input: { roleTitle: found.title, line: found.line },
        schema: figureDraftSchema,
        name: 'figure_draft',
        description: 'The bullet rewritten around a gap where the user writes its real result.',
        context: { userId: identity.userId, correlationId: null, promptVersionId: found.prompt.id },
      }));
      await deps.ai.cache.set(key, data, CACHE_SECONDS);
    }
    if (keepsToLine(found.line, data)) return { before: data.before, after: data.after, hint: data.hint, by: 'model' };
    deps.log.info({ event: 'figure.draft_rejected' }, 'figure draft strayed from the line; using the rules');
  } catch (error) {
    deps.log.warn({ event: 'figure.draft_failed', err: error instanceof Error ? error.message : String(error) }, 'figure draft failed; using the rules');
  }
  return fallback;
}
