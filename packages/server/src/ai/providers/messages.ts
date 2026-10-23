import Anthropic from '@anthropic-ai/sdk';
import { LlmError, type LlmRequest, type LlmResponse } from '../types';

/**
 * The Messages API request and response code, shared by `claudeDirect` (D-23) and the later
 * `claudeAws` adapter (X-10): only the client's auth and endpoint differ between them.
 *
 * Structured output is one tool whose input schema is the stage's strict schema, the same on
 * Bedrock's Messages endpoint, which keeps failover a routing change. Where the model takes it,
 * the call is forced. claude-sonnet-5-5 does not: it answers 400 "tool_choice: type "tool" and
 * "any" are not supported for this model" on every provider (2026-10-19, toreview §110.3), which
 * failed every structured stage on the generation tier. A model not known to take a forced call
 * is asked in words, with `auto`; a reply without the tool fails the schema and gets the
 * gateway's one corrective retry (P6-09).
 */

type Params = Anthropic.MessageCreateParamsNonStreaming;

/** Models seen to take a forced tool call. Anything else is asked in words (see above). */
export const forcesToolChoice = (model: string): boolean => /haiku/.test(model);

const answerWith = (name: string) => `Answer only by calling the ${name} tool.`;

export function toParams(request: LlmRequest): Params {
  const params: Params = {
    model: request.model,
    max_tokens: request.maxTokens,
    system: request.system.map((block) => ({
      type: 'text' as const,
      text: block.text,
      ...(block.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
    })),
    // Untrusted text (a JD, a resume) travels inside the user turn as data, never in the system
    // prompt; the stage's prompt says so (G9).
    messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (request.temperature !== undefined) params.temperature = request.temperature;
  if (request.output) {
    const { name } = request.output;
    params.tools = [{ name, description: request.output.description, input_schema: request.output.schema as Anthropic.Tool.InputSchema }];
    if (forcesToolChoice(request.model)) {
      params.tool_choice = { type: 'tool', name };
    } else {
      params.tool_choice = { type: 'auto' };
      // The instruction ends the last user turn, after the data it fences (G9).
      const last = params.messages.map((m) => m.role).lastIndexOf('user');
      params.messages = params.messages.map((m, i) => (i === last && typeof m.content === 'string' ? { ...m, content: `${m.content}\n\n${answerWith(name)}` } : m));
    }
  }
  return params;
}

export function fromMessage(message: Anthropic.Message, request: LlmRequest, endpoint: string): LlmResponse {
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  const tool = message.content.find((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === request.output?.name);
  return {
    text,
    data: tool?.input,
    stopReason: message.stop_reason ?? 'unknown',
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
    },
    model: message.model,
    endpoint,
  };
}

/** Maps SDK errors onto the layer's failures; only some are worth retrying. */
export function toLlmError(error: unknown): LlmError {
  if (error instanceof LlmError) return error;
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new LlmError('timeout', 'The provider timed out.', true);
  if (error instanceof Anthropic.APIConnectionError) return new LlmError('unavailable', 'The provider could not be reached.', true);
  if (error instanceof Anthropic.RateLimitError) return new LlmError('rate_limited', 'The provider is rate limiting.', true);
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return new LlmError('auth', 'The provider refused the credentials.', false);
  if (error instanceof Anthropic.BadRequestError) return new LlmError('bad_request', 'The provider rejected the request.', false);
  if (error instanceof Anthropic.APIError) {
    // 529 overloaded and 5xx are transient.
    if (error.status === 529 || (error.status ?? 0) >= 500) return new LlmError('overloaded', `The provider is overloaded (${error.status}).`, true);
    return new LlmError('error', `The provider answered ${error.status}.`, false);
  }
  return new LlmError('error', error instanceof Error ? error.message : 'Unknown provider error.', false);
}
