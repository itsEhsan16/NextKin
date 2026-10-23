import pino from 'pino';

/**
 * Structured JSON logging with ALLOWLIST redaction (ImBackendImplementationPlan P3-03, R-15, G5).
 *
 * Only fields named in ALLOWED_FIELDS reach a log line; anything else is replaced by a marker that
 * names the dropped key but never its value. Resume content, profile facts and contact details
 * therefore cannot leak through a careless `log.info({ body })`. As a second layer, any string
 * value that looks like an email address or a phone number is masked.
 */
export const ALLOWED_FIELDS = new Set([
  'event', 'service', 'requestId', 'traceId', 'method', 'route', 'status', 'durationMs',
  'client', 'clientVersion', 'routeClass', 'userId', 'authVia', 'errorCode', 'errorName',
  'dependency', 'dependencies', 'degraded', 'appEnv', 'signal', 'purpose', 'kind', 'role',
  'limit', 'remaining', 'queue', 'attempt', 'generationId', 'stage', 'inFlight', 'feature',
]);

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;

function maskString(value: string): string {
  return value.replace(EMAIL, '[email]').replace(PHONE, '[phone]');
}

function clean(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return maskString(value);
  if (depth > 3 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => clean(v, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v, depth + 1)]));
}

/** Keeps allowlisted fields, masks emails and phone numbers in them, reports what was dropped. */
export function scrub(fields: Record<string, unknown>): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (ALLOWED_FIELDS.has(key)) kept[key] = clean(value);
    else dropped.push(key);
  }
  if (dropped.length) kept.redactedFields = dropped;
  return kept;
}

export interface Logger {
  debug(fields: Record<string, unknown>, message?: string): void;
  info(fields: Record<string, unknown>, message?: string): void;
  warn(fields: Record<string, unknown>, message?: string): void;
  error(fields: Record<string, unknown>, message?: string): void;
  child(fields: Record<string, unknown>): Logger;
}

function wrap(base: pino.Logger): Logger {
  const at =
    (level: 'debug' | 'info' | 'warn' | 'error') =>
    (fields: Record<string, unknown>, message?: string) =>
      base[level](scrub(fields), message === undefined ? undefined : maskString(message));
  return {
    debug: at('debug'),
    info: at('info'),
    warn: at('warn'),
    error: at('error'),
    child: (fields) => wrap(base.child(scrub(fields))),
  };
}

export function createLogger(level: string, name: string, destination?: pino.DestinationStream): Logger {
  const base = pino({ level, name, base: { service: name } }, destination);
  return wrap(base);
}
