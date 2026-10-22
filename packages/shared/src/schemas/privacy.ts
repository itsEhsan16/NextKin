import { z } from 'zod';

import type { AiConsent } from '../models/consent';
import type { DataExportStatus } from '../models/user';

/** Consent and the data rights on the wire (ImBackendImplementationPlan P12-11, P12-12; V2 §8.5). */

export const aiConsentSchema = z.object({
  granted: z.boolean(),
  version: z.string().optional(),
  grantedAt: z.string().optional(),
  current: z.object({ version: z.string(), providers: z.array(z.object({ name: z.string(), purpose: z.string() })).readonly() }),
}) satisfies z.ZodType<AiConsent>;

export const aiConsentGrantSchema = z.object({ version: z.string().min(1).max(40) }).strict();

export const dataExportStatusSchema = z.object({
  status: z.enum(['idle', 'preparing', 'ready', 'failed']),
  requestedAt: z.string().optional(),
  readyAt: z.string().optional(),
  fileName: z.string().optional(),
  sizeLabel: z.string().optional(),
  expiresAt: z.string().optional(),
  error: z.string().optional(),
  /** A fresh 15-minute link to the archive, on every read while it is ready. */
  url: z.string().optional(),
}) satisfies z.ZodType<DataExportStatus & { url?: string }>;
