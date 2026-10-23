import type { z } from 'zod';
import type { Logger } from '../observability/logger';
import { withSpan } from '../observability/tracing';
import { estimateTokens, fitToBudget } from './budget';
import { assertNoContact, redactContact } from './pii';
import { costMicros, type AiSettings, type RouteStep } from './routing';
import { describeIssues, strictJsonSchema } from './schema';
import type { AiTrace, TraceRow } from './trace';
import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse, type ProviderName, type SystemBlock } from './types';

/**
 * The AI gateway (ImBackendImplementationPlan P6-07 to P6-12): the only way a stage calls a model.
 *
 * For each call it:
 * - refuses a stage input holding contact data, and redacts any in untrusted documents (G5);
 * - fits the untrusted text to the stage's token budget, deterministically (P6-10);
 * - tries the stage's providers in order (failover at stage granularity, recorded on the result);
 * - retries a transient failure (refusal, overload, rate limit, timeout) once, with full jitter;
 * - validates structured output against the zod schema, with one corrective retry (P6-09);
 * - stops live developer calls past the daily cap (D-23);
 * - traces every attempt with its tokens, cache reads and cost (P6-10).
 */

export interface CallContext {
  userId?: string | null;
  generationId?: string | null;
  correlationId?: string | null;
  promptVersionId?: string | null;
  /** Eval and developer calls never count as product spend. */
  tag?: 'product' | 'eval' | 'dev';
}

export interface StageCall {
  /** The routing key: which providers, models and budget this call gets. */
  stage: string;
  /** The stable prefix (instructions); cached after its last block. */
  system: SystemBlock[];
  /** Structured, PII-free stage input (checked at run time as well as by `StageInput<T>`). */
  input: unknown;
  /** A document the user supplied (a JD, resume text): budgeted, contact-redacted, passed as data. */
  untrusted?: string;
  context: CallContext;
}

export interface CallMeta {
  provider: ProviderName;
  model: string;
  attempts: number;
  failedOver: boolean;
  truncated: boolean;
  costMicros: number;
}

export interface ProviderRegistry {
  /** The adapter for a route's provider family, or null when that family is not configured here. */
  resolve(family: RouteStep['provider']): LlmProvider | null;
  /** Live calls billed to a developer's own key (D-23): capped, and tagged `dev`. */
  isDeveloperKey(provider: LlmProvider): boolean;
}

export interface GatewayOptions {
  settings: AiSettings;
  providers: ProviderRegistry;
  trace: AiTrace;
  log: Logger;
  developer: string;
  dailyCapUsd: number;
  /** Test seam: the wait before a retry. */
  retryDelayMs?: (attempt: number) => number;
  /** R-09: told when a product call succeeds or the providers are out, for the degraded banner. */
  onAvailability?: (available: boolean) => void;
}

export interface AiGateway {
  extract<T>(call: StageCall & { schema: z.ZodType<T>; name: string; description: string }): Promise<{ data: T; meta: CallMeta }>;
  generate(call: StageCall): Promise<{ text: string; meta: CallMeta }>;
  stream(call: StageCall, onText: (delta: string) => void): Promise<{ text: string; meta: CallMeta }>;
}

/** Failures that mean the AI is unavailable, as opposed to one bad answer. */
const OUTAGES = new Set<LlmError['failure']>(['rate_limited', 'overloaded', 'timeout', 'unavailable', 'error', 'auth']);

const OUTCOME: Record<string, TraceRow['outcome']> = { refusal: 'refusal', invalid_output: 'invalid_output', capped: 'capped' };

export function createAiGateway(options: GatewayOptions): AiGateway {
  const { settings, providers, trace, log } = options;
  const delay = options.retryDelayMs ?? ((attempt) => Math.floor(Math.random() * Math.min(2000, 250 * 2 ** attempt)));

  function userContent(call: StageCall, step: RouteStep): { content: string; truncated: boolean } {
    assertNoContact(call.input);
    const input = JSON.stringify(call.input ?? {}, null, 1);
    if (call.untrusted === undefined) return { content: `<input>\n${input}\n</input>`, truncated: false };
    const room = step.inputBudgetTokens - estimateTokens(input) - call.system.reduce((n, b) => n + estimateTokens(b.text), 0);
    const document = fitToBudget(redactContact(call.untrusted), Math.max(100, room));
    // The document is data: fenced, and the system prompt says never to follow instructions inside it (G9).
    return { content: `<input>\n${input}\n</input>\n<document>\n${document.text}\n</document>`, truncated: document.truncated };
  }

  async function spentTodayMicros(): Promise<number> {
    return trace.developerSpendTodayMicros(options.developer);
  }

  async function run<T>(call: StageCall, mode: { schema?: z.ZodType<T>; name?: string; description?: string; onText?: (d: string) => void }) {
    const route = await settings.routeFor(call.stage);
    const prices = await settings.prices();
    let last: LlmError = new LlmError('unavailable', `No provider is configured for stage "${call.stage}".`, false);
    let attempts = 0;

    for (const [index, step] of route.entries()) {
      const provider = providers.resolve(step.provider);
      if (!provider) continue;
      const developerKey = providers.isDeveloperKey(provider);
      const tag = developerKey ? 'dev' : (call.context.tag ?? 'product');
      const { content, truncated } = userContent(call, step);
      const request: LlmRequest = {
        model: step.model,
        maxTokens: step.maxTokens,
        temperature: step.temperature,
        system: call.system.map((block, i) => ({ ...block, cache: block.cache ?? i === call.system.length - 1 })),
        messages: [{ role: 'user', content }],
        output: mode.schema ? { name: mode.name!, description: mode.description!, schema: strictJsonSchema(mode.schema) } : undefined,
      };

      let corrective = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        attempts++;
        if (developerKey && options.dailyCapUsd >= 0 && (await spentTodayMicros()) >= options.dailyCapUsd * 1_000_000) {
          last = new LlmError('capped', `The daily cap of $${options.dailyCapUsd} on live calls is used up.`, false);
          await trace.record({ ...base(call, provider, step, tag, truncated), outcome: 'capped', error_code: 'capped' });
          throw last;
        }
        const started = Date.now();
        let response: LlmResponse | null = null;
        try {
          response = await withSpan('ai.call', { 'ai.stage': call.stage, 'ai.provider': provider.name, 'ai.model': step.model }, () =>
            mode.onText && provider.stream ? provider.stream(request, mode.onText) : provider.messages(request),
          );
          if (response.stopReason === 'refusal') throw new LlmError('refusal', 'The model declined to answer.', true);
          let value: unknown = response.text;
          if (mode.schema) {
            const parsed = mode.schema.safeParse(response.data);
            if (!parsed.success) {
              if (corrective) throw new LlmError('invalid_output', `The answer did not match the schema: ${describeIssues(parsed.error)}`, false);
              corrective = true;
              request.messages = [
                ...request.messages,
                { role: 'assistant', content: JSON.stringify(response.data ?? null) },
                { role: 'user', content: `That answer did not match the schema: ${describeIssues(parsed.error)}. Call the tool again with a corrected answer.` },
              ];
              await trace.record({ ...base(call, provider, step, tag, truncated), ...usage(response, prices, step), latency_ms: Date.now() - started, outcome: 'invalid_output', error_code: 'schema' });
              continue;
            }
            value = parsed.data;
          } else if (!response.text.trim()) {
            throw new LlmError('refusal', 'The model returned nothing.', true);
          }
          const cost = costMicros(prices, step.model, response.usage);
          await trace.record({ ...base(call, provider, step, tag, truncated), ...usage(response, prices, step), latency_ms: Date.now() - started, outcome: 'ok' });
          log.info({ event: 'ai.call', stage: call.stage, provider: provider.name, model: step.model, tokensIn: response.usage.inputTokens, tokensOut: response.usage.outputTokens, cacheRead: response.usage.cacheReadTokens, costMicros: cost, failedOver: index > 0 }, 'ai call');
          if ((call.context.tag ?? 'product') !== 'eval') options.onAvailability?.(true);
          return { value: value as T, meta: { provider: provider.name, model: step.model, attempts, failedOver: index > 0, truncated, costMicros: cost } satisfies CallMeta };
        } catch (error) {
          last = error instanceof LlmError ? error : new LlmError('error', error instanceof Error ? error.message : 'unknown', false);
          await trace.record({
            ...base(call, provider, step, tag, truncated),
            ...(response ? usage(response, prices, step) : {}),
            latency_ms: Date.now() - started,
            outcome: OUTCOME[last.failure] ?? 'error',
            error_code: last.failure,
          });
          if (last.failure === 'capped' || !last.retryable || attempt >= 1) break;
          await new Promise((resolve) => setTimeout(resolve, delay(attempt)));
        }
      }
      log.warn({ event: 'ai.failover', stage: call.stage, from: provider.name, failure: last.failure }, 'ai provider failed; trying the next');
    }
    // Every provider in the route is out (not a refusal or a bad answer): the banner should say so.
    if (OUTAGES.has(last.failure) && (call.context.tag ?? 'product') !== 'eval') options.onAvailability?.(false);
    throw last;
  }

  function base(call: StageCall, provider: LlmProvider, step: RouteStep, tag: TraceRow['tag'], truncated: boolean): TraceRow {
    return {
      subject_user_id: call.context.userId ?? null,
      generation_id: call.context.generationId ?? null,
      stage: call.stage,
      provider: provider.name,
      endpoint: provider.name,
      model: step.model,
      prompt_version_id: call.context.promptVersionId ?? null,
      tag,
      correlation_id: call.context.correlationId ?? null,
      developer: tag === 'dev' ? options.developer : null,
      truncated,
      outcome: 'ok',
    };
  }

  function usage(response: LlmResponse, prices: Awaited<ReturnType<AiSettings['prices']>>, step: RouteStep): Partial<TraceRow> {
    return {
      endpoint: response.endpoint,
      input_tokens: response.usage.inputTokens,
      output_tokens: response.usage.outputTokens,
      cache_read_tokens: response.usage.cacheReadTokens,
      cache_write_tokens: response.usage.cacheWriteTokens,
      cost_micros: costMicros(prices, step.model, response.usage),
    };
  }

  return {
    async extract(call) {
      const { value, meta } = await run(call, { schema: call.schema, name: call.name, description: call.description });
      return { data: value, meta };
    },
    async generate(call) {
      const { value, meta } = await run<string>(call, {});
      return { text: value, meta };
    },
    async stream(call, onText) {
      const { value, meta } = await run<string>(call, { onText });
      return { text: value, meta };
    },
  };
}
