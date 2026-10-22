import { z } from 'zod';
import type { AppSettings, PrivacySettings } from '../models/settings';
import type { ProfileLink } from '../models/profile';

/**
 * Wire schemas for the first API resources (ImBackendImplementationPlan P3-02). The model types
 * stay the source of truth for now; each schema is checked against its type with `satisfies`, so
 * a model change that the schema does not follow fails typecheck in both apps and the server.
 */

export const appSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  dateFormat: z.enum(['d_mmm_y', 'mmm_d_y', 'dd_mm_y', 'mm_dd_y', 'y_mm_dd']),
  timeZone: z.string().min(1).max(64),
  aiSuggestions: z.boolean(),
  experimentalFeatures: z.boolean(),
  personalizedRecommendations: z.boolean(),
}) satisfies z.ZodType<AppSettings>;

export const appSettingsPatchSchema = appSettingsSchema.partial().strict();

export const privacySettingsSchema = z.object({
  profileVisibility: z.enum(['recruiters', 'public', 'private']),
  recruitersCanFind: z.boolean(),
  searchEngines: z.boolean(),
  shareAnonymizedData: z.boolean(),
}) satisfies z.ZodType<PrivacySettings>;

export const privacySettingsPatchSchema = privacySettingsSchema.partial().strict();

export const profileLinkSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(100),
  url: z.url({ protocol: /^https?$/ }).max(2000),
  kind: z.enum(['portfolio', 'linkedin', 'github', 'website', 'other']).optional(),
}) satisfies z.ZodType<ProfileLink>;

export const profileLinkInputSchema = profileLinkSchema.omit({ id: true }).strict();
