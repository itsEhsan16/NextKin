import { createHash } from 'node:crypto';
import { LlmError, type JsonSchema, type LlmProvider, type LlmRequest, type LlmResponse } from '../types';

/**
 * `fake` (ImBackendImplementationPlan P6-08): deterministic and schema-valid, for unit tests. The
 * same request always gets the same answer. A test can script answers — a refusal, a malformed
 * object, an outage — to drive the gateway's retry and failover paths.
 */
export type FakeScript = (request: LlmRequest, call: number) => Partial<LlmResponse> | LlmError | undefined;

export function createFakeProvider(options: { script?: FakeScript; name?: 'fake' | 'recorded' } = {}): LlmProvider & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  return {
    name: options.name ?? 'fake',
    calls,
    async messages(request) {
      calls.push(request);
      const scripted = options.script?.(request, calls.length);
      if (scripted instanceof LlmError) throw scripted;
      const seed = createHash('sha256').update(JSON.stringify(request)).digest('hex').slice(0, 8);
      const base: LlmResponse = {
        text: request.output ? '' : `fake answer ${seed}`,
        data: request.output ? sample(request.output.schema, 'value') : undefined,
        stopReason: request.output ? 'tool_use' : 'end_turn',
        usage: { inputTokens: Math.ceil(JSON.stringify(request.messages).length / 4), outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 },
        model: request.model,
        endpoint: 'fake',
      };
      return { ...base, ...scripted };
    },
    async stream(request, onText) {
      const response = await this.messages(request);
      for (const word of response.text.split(/(?<= )/)) onText(word);
      return response;
    },
  };
}

/** The smallest value that satisfies a (strict) JSON schema, deterministically. */
export function sample(schema: JsonSchema, name: string): unknown {
  if (Array.isArray(schema.enum)) return schema.enum[0];
  if (schema.const !== undefined) return schema.const;
  const anyOf = (schema.anyOf ?? schema.oneOf) as JsonSchema[] | undefined;
  if (anyOf?.length) return sample(anyOf.find((s) => s.type !== 'null') ?? anyOf[0]!, name);
  const type = Array.isArray(schema.type) ? (schema.type as string[]).find((t) => t !== 'null') : schema.type;
  switch (type) {
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries((schema.properties ?? {}) as Record<string, JsonSchema>)) out[key] = sample(value, key);
      return out;
    }
    case 'array':
      return Array.from({ length: Number(schema.minItems ?? 1) }, () => sample((schema.items ?? {}) as JsonSchema, name));
    case 'integer':
    case 'number':
      return Number(schema.minimum ?? 0);
    case 'boolean':
      return false;
    case 'null':
      return null;
    default: {
      const text = `fake ${name}`;
      const min = Number(schema.minLength ?? 0);
      return text.length >= min ? text.slice(0, Number(schema.maxLength ?? text.length)) : text.padEnd(min, '.');
    }
  }
}
