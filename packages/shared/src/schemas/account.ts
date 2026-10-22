import { z } from 'zod';
import type { ActivityEntry } from '../models/activity';
import type { NotificationPrefs, NotificationSettings } from '../models/notification';
import type { ConnectedAccount } from '../models/settings';
import type { AccountSecurity, DashboardStats, User } from '../models/user';

/**
 * The account over the wire (ImBackendImplementationPlan P5-05, P5-06): the endpoints §11 never
 * named, designed under C-05. Each schema is checked against its model type.
 */

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  avatarUrl: z.string().optional(),
  emailVerified: z.boolean().optional(),
  createdAt: z.string(),
}) satisfies z.ZodType<User>;

export const namePatchSchema = z
  .object({ firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().max(100) })
  .strict();

/** Starts an email change: a code goes to the NEW address, and nothing changes until it is confirmed. */
export const emailChangeSchema = z.object({ email: z.email().max(254) }).strict();
export const emailConfirmSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();

export const accountSecuritySchema = z.object({
  passwordChangedAt: z.string().optional(),
  twoFactorEnabled: z.boolean(),
  sessions: z.array(
    z.object({
      id: z.string(),
      device: z.enum(['desktop', 'phone', 'tablet']),
      platform: z.string(),
      browser: z.string(),
      location: z.string(),
      lastActiveAt: z.string(),
      current: z.boolean(),
    }),
  ),
}) satisfies z.ZodType<AccountSecurity>;

export const connectedAccountSchema = z.object({
  provider: z.enum(['google']),
  connected: z.boolean(),
  connectedAt: z.string().optional(),
}) satisfies z.ZodType<ConnectedAccount>;

export const dashboardStatsSchema = z.object({
  resumesCount: z.number().int().nonnegative(),
  activitiesCount: z.number().int().nonnegative(),
  savedJobsCount: z.number().int().nonnegative(),
}) satisfies z.ZodType<DashboardStats>;

export const activityEntrySchema = z.object({
  id: z.string(),
  kind: z.enum(['generation', 'score', 'export', 'application', 'saved_job', 'profile', 'cover_letter', 'ats_check', 'interview', 'plan']),
  title: z.string(),
  detail: z.string().optional(),
  createdAt: z.string(),
  deepLink: z.string().optional(),
  resumeId: z.string().optional(),
  jobId: z.string().optional(),
}) satisfies z.ZodType<ActivityEntry>;

const onOff = z.boolean();

export const notificationPrefsSchema = z
  .object({
    categories: z.object({ matches: onOff, closing: onOff, applications: onOff, ai: onOff, billing: onOff }).strict(),
    quietHours: onOff,
    weeklyDigest: onOff,
  })
  .strict() satisfies z.ZodType<NotificationPrefs>;

const channels = z.object({ inApp: onOff, email: onOff, push: onOff }).strict();

export const notificationSettingsSchema = z
  .object({
    channels,
    topics: z
      .object({
        jobMatches: channels,
        applicationUpdates: channels,
        interviewReminders: channels,
        resumeInsights: channels,
        productUpdates: channels,
        tips: channels,
        accountSecurity: channels,
      })
      .strict(),
  })
  .strict() satisfies z.ZodType<NotificationSettings>;
