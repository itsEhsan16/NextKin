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

/**
 * Mends the small slips a model makes in a tool answer before the schema judges it (toreview
 * §269). The tool schema is not enforced on the wire, so a long resume came back with a list sent
 * as a JSON string, a list past its cap or a full date where a month was asked, failed twice, and
 * the whole upload was refused. Here, guided by the same JSON schema the model was given:
 * - an object or list sent as a JSON string is parsed;
 * - a list past `maxItems` keeps its first items; a string past `maxLength` is cut;
 * - a string that misses its `pattern` keeps the part that matches ("2021-03-15" → "2021-03");
 * - "true"/"false" strings become booleans; a field left out becomes [] or null (where allowed);
 * - a value still wrong becomes null where null is allowed, else the list item holding it is left
 *   out. Nothing is invented: every value kept is the model's own. The zod schema still decides.
 */
export function repairToSchema(schema: JsonSchema, value: unknown): unknown {
  const out = repair(schema as SchemaNode, value);
  return out === DROP ? value : out;
}

interface SchemaNode {
  type?: string | string[];
  anyOf?: SchemaNode[];
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  maxItems?: number;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
}

const DROP = Symbol('drop');

const fromJsonString = (value: unknown, open: string): unknown => {
  if (typeof value !== 'string' || !value.trim().startsWith(open)) return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

function repairString(node: SchemaNode, value: string): string | typeof DROP {
  let s = node.maxLength !== undefined && value.length > node.maxLength ? value.slice(0, node.maxLength) : value;
  if (node.pattern) {
    const whole = new RegExp(node.pattern);
    if (!whole.test(s)) {
      const inner = new RegExp(node.pattern.replace(/^\^/, '').replace(/\$$/, '')).exec(s)?.[0];
      if (inner === undefined || !whole.test(inner)) return DROP;
      s = inner;
    }
  }
  if (node.minLength !== undefined && s.length < node.minLength) return DROP;
  return s;
}

function repair(node: SchemaNode | undefined, value: unknown): unknown {
  if (!node || typeof node !== 'object' || value === undefined) return value;
  if (node.anyOf) {
    const nullable = node.anyOf.some((branch) => branch.type === 'null');
    if (value === null) return value;
    const branches = node.anyOf.filter((branch) => branch.type !== 'null');
    if (branches.length !== 1) return value;
    const out = repair(branches[0], value);
    return out === DROP && nullable ? null : out;
  }
  switch (node.type) {
    case 'object': {
      const v = fromJsonString(value, '{');
      if (!v || typeof v !== 'object' || Array.isArray(v) || !node.properties) return v;
      const out: Record<string, unknown> = { ...(v as Record<string, unknown>) };
      for (const [key, child] of Object.entries(node.properties)) {
        if (!(key in out)) {
          // A field left out means "none": an empty list, or null where null is allowed.
          if (child.type === 'array') out[key] = [];
          else if (child.anyOf?.some((branch) => branch.type === 'null')) out[key] = null;
          continue;
        }
        const fixed = repair(child, out[key]);
        if (fixed === DROP) return DROP;
        out[key] = fixed;
      }
      return out;
    }
    case 'array': {
      const v = fromJsonString(value, '[');
      if (!Array.isArray(v)) return v;
      const items = node.items ? v.map((item) => repair(node.items, item)).filter((item) => item !== DROP) : v;
      return node.maxItems !== undefined ? items.slice(0, node.maxItems) : items;
    }
    case 'string':
      return typeof value === 'string' ? repairString(node, value) : value;
    case 'boolean':
      return value === 'true' ? true : value === 'false' ? false : value;
    default:
      return value;
  }
}

/** The validation errors, short and readable, for the one corrective retry. */
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 12)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}
