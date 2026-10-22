import { describe, expect, it } from 'vitest';

import { SCOPE_BAR, SCOPE_SET, scoreScope } from '../evals/assistantScope';
import { createEvalGateway } from '../evals/gateway';
import { createModelBrain, createStandInBrain } from '../src/assistant/brain';
import { createFakeProvider } from '../src/ai/providers/fake';
import type { LlmRequest } from '../src/ai/types';
import { PROMPTS } from '../src/seed/prompts';
import { titleFor } from '../src/services/assistant';

/**
 * The assistant's brain without a database (P11-09): the model path through the gateway, with a
 * scripted classifier; the scope harness; and the stand-in local and CI run.
 */
const fromSeed = async (name: string) => ({ id: `seed:${name}`, body: PROMPTS.find((p) => p.name === name)!.body });

/** The last user line of the fenced transcript, as the model would read it. */
const lastUser = (request: LlmRequest) => {
  const doc = /<document>\n([\s\S]*?)\n<\/document>/.exec(request.messages[0]?.content ?? '')?.[1] ?? '';
  return doc.split('\n\n').filter((l) => l.startsWith('User: ')).at(-1)?.slice(6) ?? '';
};

describe('the model brain', () => {
  it('classifies on the fast tier with the message fenced as data, and scores the set through the harness', async () => {
    const labels = new Map(SCOPE_SET.map((c) => [c.text, c.inScope]));
    const provider = createFakeProvider({
      script: (request) => (request.output?.name === 'assistant_scope' ? { data: { inScope: labels.get(lastUser(request)) ?? false, topic: labels.get(lastUser(request)) ? 'resume' : 'other' }, stopReason: 'tool_use', text: '' } : undefined),
    });
    const brain = createModelBrain(createEvalGateway(provider), fromSeed);
    const report = await scoreScope(brain);
    expect(report.accuracy).toBe(1);
    expect(report.accuracy).toBeGreaterThanOrEqual(SCOPE_BAR);
    expect(provider.calls.every((c) => c.model === 'claude-haiku-5-5')).toBe(true);
    // The user's words reach the model only inside the fence, never as instructions.
    expect(provider.calls[0]!.system.map((b) => b.text).join(' ')).not.toContain(SCOPE_SET[0]!.text);
  });

  it('streams the reply on the generation tier, with contact details redacted from the transcript', async () => {
    const provider = createFakeProvider();
    const brain = createModelBrain(createEvalGateway(provider), fromSeed);
    const deltas: string[] = [];
    const { text } = await brain.reply({ text: 'Email me at jo@example.com about my score', previous: [], userId: 'u', topic: 'ats', context: null }, (d) => deltas.push(d));
    expect(deltas.join('')).toBe(text);
    expect(provider.calls[0]!.model).toBe('claude-sonnet-5-5');
    expect(provider.calls[0]!.messages[0]!.content).not.toContain('jo@example.com');
  });
});

describe('the stand-in brain', () => {
  it('keeps a short follow-up to an on-topic chat in scope and refuses a cold off-topic one', async () => {
    const brain = createStandInBrain();
    expect((await brain.classify({ text: 'Why?', previous: [{ role: 'user', text: 'Why is my ATS score low?' }], userId: 'u' })).inScope).toBe(true);
    expect((await brain.classify({ text: 'Tell me a joke.', previous: [], userId: 'u' })).inScope).toBe(false);
    expect((await brain.classify({ text: 'Why is my ATS score 64?', previous: [], userId: 'u' })).topic).toBe('ats');
  });
});

describe('chat titles', () => {
  it('names a chat by its first question, cut near a word', () => {
    expect(titleFor('Why is my score low?')).toBe('Why is my score low?');
    expect(titleFor('How do I explain a two-year career gap to a recruiter who asks about it?')).toMatch(/…$/);
  });
});
