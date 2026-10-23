import { z } from 'zod';

/**
 * The API's error vocabulary (spec §11, ImBackendImplementationPlan §2.5). Shared so the server
 * emits exactly what the HTTP repositories map back onto NotFoundError, PlanLockedError and the
 * code-carrying errors screens already branch on.
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'PLAN_LOCKED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PRECONDITION_FAILED',
  'PRECONDITION_REQUIRED',
  'IDEMPOTENCY_MISMATCH',
  'UNREADABLE_FILE',
  'UNREADABLE_LINK',
  'ZERO_BLANK',
  'EXPORT_BLOCKED',
  'CONSENT_REQUIRED',
  'UPGRADE_REQUIRED',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'UNAVAILABLE',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** HTTP status for each code. One table, so client and server can never disagree. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  PLAN_LOCKED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  IDEMPOTENCY_MISMATCH: 422,
  UNREADABLE_FILE: 422,
  UNREADABLE_LINK: 422,
  ZERO_BLANK: 422,
  EXPORT_BLOCKED: 409,
  CONSENT_REQUIRED: 403,
  UPGRADE_REQUIRED: 426,
  PRECONDITION_REQUIRED: 428,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  UNAVAILABLE: 503,
};

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    /** Safe to show. For ZERO_BLANK it is shown to users verbatim. */
    message: z.string(),
    details: z.unknown().nullable(),
    request_id: z.string().nullable(),
  }),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
