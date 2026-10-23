import { errorEnvelopeSchema } from '@nextkin/shared/schemas/envelope';

/** Error responses every route documents. Handlers throw AppError; the error handler renders these. */
const error = (description: string) => ({ description, content: { 'application/json': { schema: errorEnvelopeSchema } } });

export const commonErrors = {
  400: error('The request is not valid (VALIDATION_FAILED).'),
  429: error('Too many requests (RATE_LIMITED). See Retry-After.'),
  500: error('Something went wrong on our side (INTERNAL).'),
} as const;

export const authErrors = {
  401: error('Not signed in (UNAUTHENTICATED).'),
  403: error('Not allowed (FORBIDDEN), including a cross-site request on a cookie session.'),
} as const;

export const writeErrors = {
  409: error('A request with the same Idempotency-Key is still in progress (CONFLICT).'),
  412: error('The resource changed since it was loaded (PRECONDITION_FAILED).'),
  422: error('The Idempotency-Key was reused with a different body (IDEMPOTENCY_MISMATCH).'),
  428: error('If-Match is required (PRECONDITION_REQUIRED).'),
} as const;

export const notFoundError = { 404: error('Not found (NOT_FOUND).') } as const;
