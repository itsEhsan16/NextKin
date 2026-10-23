import { z } from 'zod';

/** "Fit to one page" (toreview §113): running, then done (with what it did) or failed (why). */
export const resumeFitSchema = z.discriminatedUnion('status', [
  z.object({ id: z.string().optional(), status: z.literal('running') }),
  z.object({ id: z.string().optional(), status: z.literal('done'), changed: z.boolean(), pages: z.number().int().min(1), dropped: z.number().int().min(0) }),
  z.object({ id: z.string().optional(), status: z.literal('failed'), reason: z.enum(['unavailable', 'cannot_fit', 'changed_meanwhile']) }),
]);
export type ResumeFit = z.infer<typeof resumeFitSchema>;
