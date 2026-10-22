import { z } from 'zod';

import type { AssistantConversation, AssistantMessage, AssistantThreadSummary } from '../models/assistant';

/** The assistant on the wire (ImBackendImplementationPlan P11-09; V2 §7.16, §11 `/api/v1/assistant`). */

export const assistantAttachmentSchema = z.object({
  kind: z.enum(['resume', 'cover_letter', 'job', 'file']),
  id: z.string().min(1).max(200),
  title: z.string().max(200),
  detail: z.string().max(200),
});

export const assistantMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  createdAt: z.string(),
  status: z.enum(['streaming', 'complete', 'failed']),
  refusal: z.literal('off_topic').optional(),
  contextResumeId: z.string().optional(),
  attachments: z.array(assistantAttachmentSchema).optional(),
}) satisfies z.ZodType<AssistantMessage>;

export const assistantConversationSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messages: z.array(assistantMessageSchema),
}) satisfies z.ZodType<AssistantConversation>;

export const assistantThreadListSchema = z.object({
  data: z.array(
    z.object({ id: z.string(), title: z.string(), preview: z.string(), updatedAt: z.string(), current: z.boolean() }) satisfies z.ZodType<AssistantThreadSummary>,
  ),
});

/** §7.16's message: a question, at most a long paragraph; the document it is about; what was attached. */
export const assistantSendSchema = z
  .object({
    text: z.string().trim().min(1).max(4000),
    resumeId: z.string().max(100).optional(),
    attachments: z.array(assistantAttachmentSchema).max(5).optional(),
  })
  .strict();

export const assistantSendResultSchema = z.object({ user: assistantMessageSchema, reply: assistantMessageSchema });
