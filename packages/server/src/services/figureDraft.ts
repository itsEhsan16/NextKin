import { createHash } from 'node:crypto';

import { TAXONOMY } from '@nextkin/engines/datasets/taxonomy';
import { mentionsIn } from '@nextkin/engines/normalizer';
import { numbersIn } from '@nextkin/engines/numbers';
import { phraseKey } from '@nextkin/engines/text';
import { fallbackFigureDraft, type FigureDraft, type FigureOption } from '@nextkin/shared/models/tailor';
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
 *
 * The suggestion (toreview §173, owner 2026-11-07 "Enable on the server"): the model may also offer
 * one typical figure, kept apart from the line. It is never written into before/after (G13 still
 * holds for the sentence); the app shows it as "AI guess" and only a tap puts it in the gap. A
 * suggestion that isn't a short figure is dropped, the draft kept.
 *
 * The options (owner, 2026-11-14: "custom option of what and how … less effort for user, but custom
 * from ai"): two or three results this line could claim, each with the line rewritten around its own
 * gap and three amounts to pick from. Each is checked like the line (`keepsToLine`) and each amount
 * like a suggestion (`fitsSuggestion`); an option that fails is dropped, the rest kept.
 */

export const FIGURE_TEMPLATE = 'figure.draft';
const CACHE_SECONDS = 30 * 24 * 3600;
const MAX_LENGTH = 300;

export const figureDraftSchema = z.object({
  before: z.string().trim().min(1).max(MAX_LENGTH),
  after: z.string().max(120),
  hint: z.string().trim().min(1).max(80),
  // Nullable, not optional: the gateway's strict JSON schema needs every key present.
  suggestion: z.string().trim().max(60).nullable(),
  options: z
    .array(
      z.object({
        what: z.string().trim().min(1).max(60),
        before: z.string().trim().min(1).max(MAX_LENGTH),
        after: z.string().max(120),
        amounts: z.array(z.string().trim().max(60)).max(4),
      }),
    )
    .max(4),
});

const MAX_SUGGESTION = 24;

/** A suggestion is a short figure: "about 20%", "5,000 users". No technology, no claim. */
export function fitsSuggestion(suggestion: string | null | undefined): suggestion is string {
  const text = suggestion?.trim() ?? '';
  if (!text || text.length > MAX_SUGGESTION || text.split(/\s+/).length > 4) return false;
  if (!/\d/.test(text)) return false;
  return mentionsIn(TAXONOMY, text).length === 0;
}

/** A result's name: a few plain words, no figure and no technology ("sellers onboarded"). */
export function fitsWhat(what: string): boolean {
  const text = what.trim();
  if (!text || text.split(/\s+/).length > 5 || /\d/.test(text)) return false;
  return mentionsIn(TAXONOMY, text).length === 0;
}

/**
 * The options that keep to the line: each one's wording passes `keepsToLine`, its name `fitsWhat`,
 * and at least two of its amounts `fitsSuggestion`. At most three are kept, in the model's order.
 */
export function keptOptions(line: string, options: readonly FigureOption[] | undefined): FigureOption[] {
  const kept: FigureOption[] = [];
  for (const option of options ?? []) {
    if (!fitsWhat(option.what) || !keepsToLine(line, option)) continue;
    const amounts = option.amounts.map((a) => a.trim()).filter(fitsSuggestion).slice(0, 3);
    if (amounts.length < 2) continue;
    kept.push({ what: option.what.trim(), before: option.before.trim(), after: option.after, amounts });
    if (kept.length === 3) break;
  }
  return kept;
}

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
    return { line: bullet.text, title: role.title, prompt, allowed };
  });
  const fallback = fallbackDraft(found.line);
  // Say why there is no model draft, so a missing prompt can't fall back unseen (owner, 2026-11-14).
  if (deps.ai && !found.prompt)
    deps.log.warn({ event: 'figure.draft_skipped', reason: found.allowed ? 'no_active_prompt' : 'no_ai_consent' }, 'figure draft used the rules');
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
    if (keepsToLine(found.line, data)) {
      const draft: FigureDraft = { before: data.before, after: data.after, hint: data.hint, by: 'model' };
      if (fitsSuggestion(data.suggestion)) draft.suggestion = data.suggestion.trim();
      const options = keptOptions(found.line, data.options);
      if (options.length) draft.options = options;
      return draft;
    }
    deps.log.info({ event: 'figure.draft_rejected' }, 'figure draft strayed from the line; using the rules');
  } catch (error) {
    deps.log.warn({ event: 'figure.draft_failed', err: error instanceof Error ? error.message : String(error) }, 'figure draft failed; using the rules');
  }
  return fallback;
}
