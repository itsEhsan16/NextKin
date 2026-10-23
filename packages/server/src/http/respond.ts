import type { z } from 'zod';

/**
 * Response validation (ImBackendImplementationPlan P3-03). In local, test and dev every response
 * body is parsed against its declared schema before it is sent, so drift between what the server
 * returns and what the shared schema promises fails loudly here, not on a phone. Production skips
 * the cost and trusts the types.
 */
let validateResponses = true;

export function setResponseValidation(enabled: boolean): void {
  validateResponses = enabled;
}

export function checked<S extends z.ZodType>(schema: S, data: z.input<S>): z.output<S> {
  return validateResponses ? schema.parse(data) : (data as z.output<S>);
}
