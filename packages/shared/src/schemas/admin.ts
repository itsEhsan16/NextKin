import { z } from 'zod';

/**
 * The admin routes' responses, as `packages/server/src/http/routes/admin.ts` returns them. The
 * server declares them loosely (`z.unknown()`, "until the admin UI plan pins them"), so these are
 * read off the services: `services/admin/catalog.ts`, `audit.ts`, `technologies.ts`, `prompts.ts`.
 * Unknown fields pass through, so a column added on the server doesn't break the client.
 */

const role = z.enum(['support', 'curator', 'admin', 'super_admin']);

export const adminMeSchema = z.object({
  role,
  permissions: z.array(
    z.enum([
      'users.read',
      'users.manage',
      'users.content',
      'roles.assign',
      'audit.read',
      'content.manage',
      'plans.manage',
      'providers.manage',
      'providers.keys',
      'analytics.read',
    ]),
  ),
});

/** Just the naming fields of `/me`, for the staff card. */
export const adminProfileSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    firstName: z.string().nullish(),
    lastName: z.string().nullish(),
  })
  .passthrough();

/** `GET /admin/analytics`: thirty-day aggregates. */
export const adminAnalyticsSchema = z
  .object({
    users: z.object({ total: z.number(), last30: z.number() }),
    generationsLast30Days: z.array(
      z.object({ kind: z.string(), status: z.string(), n: z.number() }),
    ),
    atsScoreDistribution: z.array(z.object({ bucket: z.string(), n: z.number() })),
    aiSpendLast30Days: z.array(z.object({ tag: z.string(), usd: z.number(), calls: z.number() })),
    subscriptions: z.array(z.object({ plan_id: z.string(), status: z.string(), n: z.number() })),
    quotaUseThisMonth: z.array(z.object({ metric: z.string(), used: z.number() })),
  })
  .passthrough();

/** `GET /admin/audit`: newest first. */
export const adminAuditSchema = z.object({
  data: z.array(
    z
      .object({
        id: z.union([z.number(), z.string()]),
        actorUserId: z.string().nullable(),
        actorRole: z.string().nullable(),
        action: z.string(),
        targetType: z.string().nullable(),
        targetId: z.string().nullable(),
        /** What the change left (jsonb). A content read targets the resume and names its owner here. */
        after: z.unknown().optional(),
        reason: z.string().nullable(),
        createdAt: z.string(),
      })
      .passthrough(),
  ),
});

/** `GET /admin/kb/queue`: what curators review. */
export const adminKbQueueSchema = z
  .object({ candidates: z.array(z.unknown()), reports: z.array(z.unknown()) })
  .passthrough();

/** `GET /admin/prompts`: each prompt and its versions, newest first. */
export const adminPromptsSchema = z.object({
  data: z.array(
    z
      .object({
        name: z.string(),
        versions: z.array(
          z
            .object({
              version: z.number(),
              status: z.string(),
              /** The version has a passing evaluation (`eval_run_ref` is set). */
              evaluated: z.boolean().optional(),
            })
            .passthrough(),
        ),
      })
      .passthrough(),
  ),
});
