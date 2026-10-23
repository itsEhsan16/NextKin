import { z } from 'zod';
import type { JsonSchema } from './types';

/**
 * Structured outputs (ImBackendImplementationPlan P6-09). The JSON schema a model fills comes from
 * the same zod schema the server validates the answer with, made strict: every object closed
 * (`additionalProperties: false`) and every property listed in `required`. A field that may be
 * absent is written as nullable in zod, so "required" never forces the model to invent a value.
 */
export function strictJsonSchema(schema: z.ZodType): JsonSchema {
  const json = z.toJSONSchema(schema, { target: 'draft-7', unrepresentable: 'throw' }) as JsonSchema;
  return close(json);
}

function close(node: unknown): JsonSchema {
  if (Array.isArray(node)) return node.map(close) as unknown as JsonSchema;
  if (!node || typeof node !== 'object') return node as JsonSchema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === '$schema') continue;
    out[key] = typeof value === 'object' ? close(value) : value;
  }
  if (out.type === 'object' && out.properties && typeof out.properties === 'object') {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties as object);
  }
  return out;
}

/** The validation errors, short and readable, for the one corrective retry. */
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 12)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}
