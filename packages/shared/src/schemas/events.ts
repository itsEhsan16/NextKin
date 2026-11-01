import { z } from 'zod';

/**
 * Usage events (owner, 2026-10-31; V2 §8.5). The list is fixed on purpose, and a property is a short
 * label from code, so nothing anyone typed can travel here. Events cover what only the app sees:
 * runs, exports and saves are already on the server, so counting them again would add nothing.
 */
export const EVENT_NAMES = [
  'app_opened',
  'sign_up_completed',
  'job_added',
  'link_unreadable',
  'apply_opened',
  'apply_answered',
  'paywall_seen',
  'push_opened',
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/** Labels only: how a job came in, why a link failed, what they answered. */
const label = z.string().regex(/^[a-z0-9_-]{1,40}$/);

export const productEventSchema = z
  .object({
    name: z.enum(EVENT_NAMES),
    at: z.iso.datetime(),
    properties: z.partialRecord(z.enum(['how', 'reason', 'answer']), label).optional(),
  })
  .strict();

export const productEventsSchema = z.object({ events: z.array(productEventSchema).min(1).max(30) }).strict();

export type ProductEvent = z.infer<typeof productEventSchema>;
