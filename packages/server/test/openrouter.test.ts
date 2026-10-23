import { afterEach, describe, expect, it, vi } from 'vitest';

import { forcesToolChoice, toParams } from '../src/ai/providers/messages';
import { createOpenRouter, openRouterModel } from '../src/ai/providers/openrouter';
import { setEgressAllowlist } from '../src/net/egress';

/** toreview §108: the `claude` family through OpenRouter's Anthropic-compatible endpoint. */

afterEach(() => setEgressAllowlist([]));

const answer = {
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'anthropic/claude-sonnet-5.5',
  content: [{ type: 'tool_use', id: 'tu_1', name: 'resume', input: { summary: 'ok' } }],
  stop_reason: 'tool_use',
  stop_sequence: null,
  usage: { input_tokens: 12, output_tokens: 3 },
};

describe('the OpenRouter provider', () => {
  it('maps the Claude ids onto OpenRouter ids', () => {
    expect(openRouterModel('claude-sonnet-5-5')).toBe('anthropic/claude-sonnet-5.5');
    expect(openRouterModel('claude-haiku-4-5')).toBe('anthropic/claude-haiku-4.5');
    expect(openRouterModel('claude-opus-5')).toBe('anthropic/claude-opus-5');
  });

  it('sends a Messages call to OpenRouter with a bearer key and the translated model', async () => {
    const base = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(answer), { headers: { 'content-type': 'application/json' } }));
    setEgressAllowlist(['openrouter.ai'], base);
    const response = await createOpenRouter('sk-or-test-key').messages({
      model: 'claude-sonnet-5-5',
      maxTokens: 100,
      system: [{ text: 'Write a resume.' }],
      messages: [{ role: 'user', content: 'facts' }],
      output: { name: 'resume', description: 'The resume.', schema: { type: 'object' } },
    });
    const [input, init] = base.mock.calls[0]!;
    expect(String(input)).toBe('https://openrouter.ai/api/v1/messages');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer sk-or-test-key');
    expect(headers.get('x-api-key')).toBeNull();
    // claude-sonnet-5-5 refuses a forced tool call (400 on every provider): it is asked in words.
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'anthropic/claude-sonnet-5.5', tool_choice: { type: 'auto' }, messages: [{ role: 'user', content: 'facts\n\nAnswer only by calling the resume tool.' }] });
    expect(response).toMatchObject({ data: { summary: 'ok' }, endpoint: 'openrouter.ai/api/v1/messages', usage: { inputTokens: 12, outputTokens: 3 } });
  });
});

describe('structured output (toreview §110.3)', () => {
  const request = (model: string) => ({
    model,
    maxTokens: 100,
    system: [{ text: 'Read the job.' }],
    messages: [
      { role: 'user' as const, content: 'the JD' },
      { role: 'assistant' as const, content: 'not a tool call' },
      { role: 'user' as const, content: 'Call the tool again.' },
    ],
    output: { name: 'job_description', description: 'The job.', schema: { type: 'object' } },
  });

  it('forces the tool where the model takes it', () => {
    expect(forcesToolChoice('claude-haiku-5-5')).toBe(true);
    expect(forcesToolChoice('us.anthropic.claude-haiku-5-5')).toBe(true);
    const params = toParams(request('claude-haiku-5-5'));
    expect(params.tool_choice).toEqual({ type: 'tool', name: 'job_description' });
    expect(params.messages.map((m) => m.content)).toEqual(['the JD', 'not a tool call', 'Call the tool again.']);
  });

  it('asks in words where it does not, at the end of the last user turn only', () => {
    expect(forcesToolChoice('claude-sonnet-5-5')).toBe(false);
    const params = toParams(request('claude-sonnet-5-5'));
    expect(params.tool_choice).toEqual({ type: 'auto' });
    expect(params.tools).toEqual([expect.objectContaining({ name: 'job_description' })]);
    expect(params.messages.map((m) => m.content)).toEqual(['the JD', 'not a tool call', 'Call the tool again.\n\nAnswer only by calling the job_description tool.']);
  });
});
