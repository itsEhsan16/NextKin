import { ERROR_STATUS, type ErrorCode, type ErrorEnvelope } from '@nextkin/shared/schemas/envelope';

/**
 * Every failure a route can produce is an AppError (ImBackendImplementationPlan P3-03, §2.5).
 * The error handler turns it into the envelope `{ error: { code, message, details, request_id } }`
 * with the status from the shared ERROR_STATUS table, so client and server cannot disagree.
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details: unknown = null,
    public readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'AppError';
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

export const errors = {
  validation: (details: unknown, message = 'The request is not valid.') => new AppError('VALIDATION_FAILED', message, details),
  unauthenticated: () => new AppError('UNAUTHENTICATED', 'Sign in to continue.'),
  forbidden: () => new AppError('FORBIDDEN', 'You do not have access to this.'),
  notFound: (what = 'resource') => new AppError('NOT_FOUND', `That ${what} does not exist.`),
  conflict: (message: string) => new AppError('CONFLICT', message),
  preconditionFailed: () => new AppError('PRECONDITION_FAILED', 'This changed since you loaded it. Reload and try again.'),
  preconditionRequired: () => new AppError('PRECONDITION_REQUIRED', 'Send If-Match with the ETag you loaded.'),
  idempotencyMismatch: () =>
    new AppError('IDEMPOTENCY_MISMATCH', 'This Idempotency-Key was already used for a different request.'),
  upgradeRequired: (minimum: string) =>
    new AppError('UPGRADE_REQUIRED', 'Update the app to keep going.', { minimumVersion: minimum }),
  payloadTooLarge: () => new AppError('PAYLOAD_TOO_LARGE', 'The request body is too large.'),
  rateLimited: (retryAfterSeconds: number) =>
    new AppError('RATE_LIMITED', 'Too many requests. Try again shortly.', { retryAfterSeconds }, {
      'Retry-After': String(retryAfterSeconds),
    }),
  unavailable: (message = 'This is temporarily unavailable.') => new AppError('UNAVAILABLE', message),
};

export function envelope(code: ErrorCode, message: string, details: unknown, requestId: string | null): ErrorEnvelope {
  return { error: { code, message, details: details ?? null, request_id: requestId } };
}
