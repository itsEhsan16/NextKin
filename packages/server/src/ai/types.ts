/**
 * The AI layer's provider-neutral shapes (ImBackendImplementationPlan P6-07). They follow the
 * Messages API, because every planned provider speaks it (Claude Platform direct and on AWS, and
 * Bedrock's Messages endpoint); an OpenAI adapter maps onto it.
 */

export type JsonSchema = Record<string, unknown>;

export interface SystemBlock {
  text: string;
  /** Cache breakpoint after this block (P6-10): put it after the stable prefix. */
  cache?: boolean;
}

export interface LlmRequest {
  model: string;
  maxTokens: number;
  temperature?: number;
  system: SystemBlock[];
  messages: { role: 'user' | 'assistant'; content: string }[];
  /** Structured output: the model must answer by filling this schema (a forced tool call). */
  output?: { name: string; description: string; schema: JsonSchema };
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface LlmResponse {
  /** Free text, for `generate` and `stream`. */
  text: string;
  /** The filled schema, for `extract`; undefined when the model did not call the tool. */
  data?: unknown;
  stopReason: string;
  usage: LlmUsage;
  /** The model that actually answered, as the provider reports it. */
  model: string;
  endpoint: string;
}

/** A provider adapter: one Messages-shaped call, and optionally a stream of text deltas. */
export interface LlmProvider {
  readonly name: ProviderName;
  messages(request: LlmRequest, signal?: AbortSignal): Promise<LlmResponse>;
  stream?(request: LlmRequest, onText: (delta: string) => void, signal?: AbortSignal): Promise<LlmResponse>;
}

export type ProviderName = 'fake' | 'recorded' | 'claudeDirect' | 'claudeAws' | 'bedrock' | 'openai' | 'openrouter';

/** Why a call failed, which decides whether the next attempt or provider should be tried. */
export type LlmFailure = 'refusal' | 'invalid_output' | 'rate_limited' | 'overloaded' | 'timeout' | 'auth' | 'bad_request' | 'capped' | 'no_recording' | 'unavailable' | 'error';

export class LlmError extends Error {
  constructor(
    readonly failure: LlmFailure,
    message: string,
    /** Retrying the same provider may succeed (refusal, overload, rate limit, timeout). */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}
