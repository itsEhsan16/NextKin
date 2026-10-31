import { z } from 'zod';

/**
 * The message envelope (ImBackendImplementationPlan P6-01). Every queue message is one of these,
 * validated when the relay publishes it and again when the worker receives it: a message that does
 * not parse is poison, never half-processed.
 *
 * `id` is the outbox row id, which is also the SQS deduplication id, so a relay that publishes the
 * same row twice (crash between publish and mark) delivers it once within SQS's 5-minute window,
 * and consumers are idempotent for anything older.
 */

export const QUEUES = ['generation-priority', 'generation-standard', 'maintenance'] as const;
export type QueueName = (typeof QUEUES)[number];
export type DlqName = `${QueueName}-dlq`;
export const dlqOf = (queue: QueueName): DlqName => `${queue}-dlq`;

/** Maintenance jobs the scheduler enqueues (P6-06). */
export const MAINTENANCE_JOBS = [
  'generation_sweep',
  'upload_orphan_sweep',
  'outbox_cleanup',
  'anonymous_upload_purge',
  'trash_purge',
  'jobs_cache_expiry',
  'trending',
  'eval_nightly',
  'kb_candidates',
  'account_purge',
  'audit_export',
  'closing_alerts',
  'notification_purge',
  'event_purge',
] as const;
export type MaintenanceJob = (typeof MAINTENANCE_JOBS)[number];

export const generationRunSchema = z.object({ generationId: z.uuid(), userId: z.uuid() }).strict();
export const maintenanceRunSchema = z.object({ job: z.enum(MAINTENANCE_JOBS), windowStart: z.iso.datetime() }).strict();
// P7: an upload's scan, a resume parse, and the anonymous teaser.
export const uploadScanSchema = z.object({ uploadId: z.uuid(), userId: z.uuid() }).strict();
export const resumeParseSchema = z.object({ parseId: z.uuid(), userId: z.uuid() }).strict();
export const teaserProcessSchema = z.object({ teaserId: z.uuid() }).strict();
// P9: a job description's extraction, awaited by the client.
export const jdExtractSchema = z.object({ jdId: z.uuid(), userId: z.uuid() }).strict();
// P10: rendering one export (PDF, DOCX or TXT) on the worker.
export const exportRenderSchema = z.object({ exportId: z.uuid(), userId: z.uuid() }).strict();
// toreview §111: typesetting one resume version with LaTeX on the worker.
export const renderCompileSchema = z.object({ renderId: z.uuid(), userId: z.uuid() }).strict();
/** "Fit to one page" (toreview §113): fit the version that was current when it was asked. */
export const resumeFitSchema = z.object({ fitId: z.uuid(), userId: z.uuid(), resumeId: z.uuid(), versionId: z.uuid() }).strict();
// P12: a stored billing webhook to apply; a data-export bundle to build.
export const billingWebhookSchema = z.object({ webhookEventId: z.uuid() }).strict();
export const accountExportSchema = z.object({ exportId: z.uuid(), userId: z.uuid() }).strict();
export const promptEvaluateSchema = z.object({ evaluationId: z.uuid() }).strict();

export const envelopeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('generation.run'),
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(80),
    correlationId: z.string().max(128).nullable(),
    payload: generationRunSchema,
  }),
  z.object({ type: z.literal('upload.scan'), schemaVersion: z.literal(1), id: z.string().min(1).max(80), correlationId: z.string().max(128).nullable(), payload: uploadScanSchema }),
  z.object({ type: z.literal('resume.parse'), schemaVersion: z.literal(1), id: z.string().min(1).max(80), correlationId: z.string().max(128).nullable(), payload: resumeParseSchema }),
  z.object({ type: z.literal('teaser.process'), schemaVersion: z.literal(1), id: z.string().min(1).max(80), correlationId: z.string().max(128).nullable(), payload: teaserProcessSchema }),
  z.object({ type: z.literal('jd.extract'), schemaVersion: z.literal(1), id: z.string().min(1).max(80), correlationId: z.string().max(128).nullable(), payload: jdExtractSchema }),
  z.object({ type: z.literal('export.render'), schemaVersion: z.literal(1), id: z.string().min(1).max(80), correlationId: z.string().max(128).nullable(), payload: exportRenderSchema }),
  z.object({ type: z.literal('render.compile'), schemaVersion: z.literal(1), id: z.string().min(1).max(80), correlationId: z.string().max(128).nullable(), payload: renderCompileSchema }),
  z.object({ type: z.literal('resume.fit'), schemaVersion: z.literal(1), id: z.string().min(1).max(80), correlationId: z.string().max(128).nullable(), payload: resumeFitSchema }),
  z.object({ type: z.literal('billing.webhook'), schemaVersion: z.literal(1), id: z.string().min(1).max(80), correlationId: z.string().max(128).nullable(), payload: billingWebhookSchema }),
  z.object({ type: z.literal('prompt.evaluate'), schemaVersion: z.literal(1), id: z.string().min(1).max(80), correlationId: z.string().max(128).nullable(), payload: promptEvaluateSchema }),
  z.object({ type: z.literal('account.export'), schemaVersion: z.literal(1), id: z.string().min(1).max(80), correlationId: z.string().max(128).nullable(), payload: accountExportSchema }),
  z.object({
    type: z.literal('maintenance.run'),
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(80),
    correlationId: z.string().max(128).nullable(),
    payload: maintenanceRunSchema,
  }),
]);

export type Envelope = z.infer<typeof envelopeSchema>;
export type MessageType = Envelope['type'];
export type PayloadOf<T extends MessageType> = Extract<Envelope, { type: T }>['payload'];

/**
 * The FIFO group (P6-01): `user_id#slot`, slot 0 or 1 from the generation id. SQS delivers one
 * message per group at a time, so a user has at most two jobs running however many they submit,
 * and a retry of the same generation always lands in the same group.
 */
export function generationGroup(userId: string, generationId: string): string {
  const last = generationId.replace(/-/g, '').at(-1) ?? '0';
  return `${userId}#${parseInt(last, 16) % 2}`;
}
