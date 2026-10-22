import { answerFor } from '@nextkin/shared/assistant/answers';
import type { AssistantContext } from '@nextkin/shared/assistant/context';
import { classify, type AssistantTopic } from '@nextkin/shared/assistant/domain';
import { z } from 'zod';

import type { AiGateway } from '../ai/gateway';
import type { Database } from '../db/database';
import { activePrompt, type PromptVersion } from '../services/prompts';

/**
 * The assistant's two model steps behind one port (ImBackendImplementationPlan P11-09; V2 §7.16):
 * the fast-tier classifier that gates every message, and the reply, streamed.
 *
 * - `createModelBrain`: the gateway, so routing, failover, the contact guard and the call trace
 *   apply as for every stage. The message and the history go in as untrusted text (fenced and
 *   contact-redacted), never as instructions.
 * - `createStandInBrain`: deterministic, no model, for the `fake` and `recorded` routes (local and
 *   CI without a key). It is the mock's keyword classifier and answer templates, and it says so.
 */

export const ASSISTANT_TOPICS = ['resume', 'ats', 'interview', 'job_search', 'skills', 'product'] as const satisfies readonly AssistantTopic[];

export interface ServerAssistantContext extends AssistantContext {
  /** The requirement ledger behind the score: each JD requirement and whether the resume backs it. */
  requirements: { text: string; status: string; importance: string }[];
}

export interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

export interface ClassifyInput {
  text: string;
  /** The last few turns, so a follow-up such as "why?" is judged with what it follows. */
  previous: Turn[];
  userId: string;
  /** A document or file came with the message: "what is wrong with it?" is then about that. */
  hasAttachment?: boolean;
}

export interface ReplyInput extends ClassifyInput {
  topic: AssistantTopic;
  context: ServerAssistantContext | null;
}

export interface AssistantBrain {
  readonly kind: 'model' | 'stand-in';
  classify(input: ClassifyInput): Promise<{ inScope: boolean; topic: AssistantTopic | null }>;
  reply(input: ReplyInput, onText: (delta: string) => void): Promise<{ text: string }>;
}

export const CLASSIFY_TEMPLATE = 'assistant.classify';
export const REPLY_TEMPLATE = 'assistant.reply';

const verdictSchema = z.object({ inScope: z.boolean(), topic: z.enum([...ASSISTANT_TOPICS, 'other']) });

const transcript = (turns: Turn[], text: string) => [...turns.map((t) => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.text}`), `User: ${text}`].join('\n\n');

export type PromptSource = (name: string) => Promise<Pick<PromptVersion, 'id' | 'body'>>;

/** Each template's active version, read as the system and cached for a minute. */
export function dbPrompts(db: Database, cacheMs = 60_000): PromptSource {
  const cache = new Map<string, { at: number; prompt: PromptVersion }>();
  return async (name) => {
    const hit = cache.get(name);
    if (hit && Date.now() - hit.at < cacheMs) return hit.prompt;
    const fresh = await db.withSystem('assistant: read the active prompt', (tx) => activePrompt(tx, name));
    cache.set(name, { at: Date.now(), prompt: fresh });
    return fresh;
  };
}

export function createModelBrain(gateway: AiGateway, prompt: PromptSource): AssistantBrain {
  return {
    kind: 'model',
    async classify({ text, previous, userId, hasAttachment }) {
      const p = await prompt(CLASSIFY_TEMPLATE);
      const { data } = await gateway.extract({
        stage: 'assistant_classify',
        system: p.body.system.map((t) => ({ text: t })),
        input: { previousTopicInScope: previous.length > 0, hasAttachment: hasAttachment === true },
        untrusted: transcript(previous.slice(-2), text),
        schema: verdictSchema,
        name: 'assistant_scope',
        description: 'Whether the last user message is within the career assistant’s scope, and its topic.',
        context: { userId, promptVersionId: p.id },
      });
      return { inScope: data.inScope && data.topic !== 'other', topic: data.topic === 'other' ? null : data.topic };
    },
    async reply({ text, previous, context, userId }, onText) {
      const p = await prompt(REPLY_TEMPLATE);
      const { text: answer } = await gateway.stream(
        {
          stage: 'assistant_reply',
          system: p.body.system.map((t) => ({ text: t })),
          input: { context },
          untrusted: transcript(previous, text),
          context: { userId, promptVersionId: p.id },
        },
        onText,
      );
      return { text: answer };
    },
  };
}

/** How a follow-up opens: "why?", "make it shorter", "can you give an example". */
const FOLLOW_UP = /^(why|how|what|which|and|so|ok|okay|can you|could you|make it|more|shorter|longer|example|explain|really|is that|does that)\b/i;

/** Deterministic: the mock's keyword classifier and answer templates, streamed a few words at a time. */
export function createStandInBrain(): AssistantBrain {
  return {
    kind: 'stand-in',
    async classify({ text, previous, hasAttachment }) {
      const verdict = classify(text);
      if (verdict.allowed) return { inScope: true, topic: verdict.topic };
      // A short question that came with a document ("what's wrong with it?") is about the document.
      if (hasAttachment && text.trim().split(/\s+/).length <= 12 && /\?$|\b(wrong|improve|better|fix|missing|review|check)\b/i.test(text)) return { inScope: true, topic: 'resume' };
      // A short follow-up to an on-topic turn ("why?", "shorter please") stays in scope.
      if (previous.length > 0 && FOLLOW_UP.test(text.trim()) && text.trim().split(/\s+/).length <= 6) return { inScope: true, topic: 'product' };
      return { inScope: false, topic: null };
    },
    async reply({ topic, context }, onText) {
      const text = answerFor(topic, context ?? undefined);
      for (const word of text.split(/(?<= )/)) onText(word);
      return { text };
    },
  };
}
