import { createHash } from 'node:crypto';

import type { KeywordQuestion } from '@nextkin/shared/models/tailor';
import { redactContact } from '@nextkin/shared/privacy/contact';
import { fitPlacesOf } from '@nextkin/shared/scoring/placeFit';
import { askable, keywordQuestions, placeLines, type QuestionContext } from '@nextkin/shared/tailor/questions';
import { z } from 'zod';

import type { AiGateway } from '../ai/gateway';
import type { KvCache } from '../cache/kv';
import type { Database, Identity } from '../db/database';
import type { Logger } from '../observability/logger';
import { hasAiConsent } from './consent';
import { activePrompt } from './prompts';
import { asOfNow, readBase } from './tailorBase';
import { compareResumeToJd } from './tailorCompare';

/**
 * "Did you use this here?" (owner, 2026-11-15; toreview §206.3): questions about keywords the job
 * asks for that the resume does not show, each beside the line of a role that hints at it. The
 * rules always answer (`ruleQuestions`: the places the comparison picked). A model may add more,
 * and all it returns is a keyword from the list it was given, a place id and a line number: code
 * checks each against the resume and the job, and writes the question itself (G14). A "yes" is
 * the candidate's own word and becomes a confirmed line through the same path as any ticked
 * keyword; nothing here adds anything to a resume.
 *
 * The model sees the job's title, the missing keywords and the resume's own lines with contact
 * details redacted (G5). Without AI consent, a model route or an active prompt, the rules' questions
 * are the answer, and the log says why.
 */

export const QUESTIONS_TEMPLATE = 'tailor.infer';
const CACHE_SECONDS = 7 * 24 * 3600;
const MAX_KEYWORDS = 25;
const MAX_LINES = 14;

export const proposalsSchema = z.object({
  questions: z.array(z.object({ keyword: z.string().trim().min(1).max(120), placeId: z.string().trim().min(1).max(200), line: z.number().int().min(0).max(60) })).max(16),
});

export interface KeywordQuestionDeps {
  db: Database;
  log: Logger;
  ai?: { gateway: AiGateway; cache: KvCache };
}

export async function askKeywordQuestions(deps: KeywordQuestionDeps, identity: Identity, request: { resumeId: string; jdId: string }): Promise<KeywordQuestion[]> {
  const comparison = await compareResumeToJd(deps.db, identity, request.jdId, request.resumeId);
  const found = await deps.db.withUser(identity, async (tx) => {
    const base = await readBase(tx, identity.userId, request.resumeId);
    const allowed = deps.ai ? await hasAiConsent(tx, identity.userId) : false;
    const prompt = allowed ? await activePrompt(tx, QUESTIONS_TEMPLATE).catch(() => null) : null;
    return { doc: base.doc, prompt, allowed };
  });
  const ctx: QuestionContext = {
    keywords: comparison.keywords,
    places: comparison.places ?? [],
    fitPlaces: fitPlacesOf(found.doc),
    ...(comparison.picks ? { picks: comparison.picks } : {}),
    asOf: asOfNow(),
  };
  const rules = keywordQuestions(ctx);
  const asked = new Set(rules.map((q) => q.keyword));
  const open = askable(ctx.keywords).filter((k) => !asked.has(k.label)).slice(0, MAX_KEYWORDS).map((k) => k.label);
  if (deps.ai && !found.prompt) deps.log.warn({ event: 'tailor.questions_skipped', reason: found.allowed ? 'no_active_prompt' : 'no_ai_consent' }, 'keyword questions used the rules');
  if (!deps.ai || !found.prompt || open.length === 0 || ctx.fitPlaces.length === 0) return rules;

  const places = ctx.fitPlaces.map((place) => ({
    id: place.id,
    title: (ctx.places.find((p) => p.id === place.id)?.label ?? '').slice(0, 160),
    lines: placeLines(place).slice(0, MAX_LINES).map((text, n) => ({ n, text: redactContact(text).slice(0, 300) })),
  }));
  const input = { keywords: open, places };
  const key = `tq:${found.prompt.id}:${createHash('sha256').update(JSON.stringify(input)).digest('hex')}`;
  try {
    let data = await deps.ai.cache.get<z.infer<typeof proposalsSchema>>(key);
    if (!data) {
      ({ data } = await deps.ai.gateway.extract({
        stage: 'keyword_questions',
        system: found.prompt.body.system.map((text) => ({ text })),
        input,
        schema: proposalsSchema,
        name: 'keyword_questions',
        description: 'For each keyword worth asking about: the place and the line that hints at it.',
        context: { userId: identity.userId, correlationId: null, promptVersionId: found.prompt.id },
      }));
      await deps.ai.cache.set(key, data, CACHE_SECONDS);
    }
    const all = keywordQuestions(ctx, data.questions.map((q) => ({ keyword: q.keyword, where: q.placeId, line: q.line })));
    deps.log.info({ event: 'tailor.questions', rules: rules.length, proposed: data.questions.length, kept: all.length - rules.length }, 'keyword questions');
    return all;
  } catch (error) {
    deps.log.warn({ event: 'tailor.questions_failed', err: error instanceof Error ? error.message : String(error) }, 'keyword questions failed; using the rules');
    return rules;
  }
}
