import { z } from 'zod';

import type { AdminResumeContent } from '../models/adminPeople';
import {
  RESUME_SECTION_LABEL,
  RESUME_SECTION_ORDER,
  type ResumeSectionKey,
} from '../models/resumeContent';

/**
 * The People routes' responses, as `packages/server/src/http/routes/admin.ts` returns them from
 * `services/admin/users.ts`. The server declares them as `z.unknown()`, so these are read off the
 * services. Unknown fields pass through, so a column added on the server doesn't break the client.
 */

/** `searchUsers`: `name` is the first and last name joined and trimmed, so it can be empty. */
export const adminUserSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    status: z.string(),
    createdAt: z.string(),
  })
  .passthrough();

export const adminUserSearchSchema = z.object({ data: z.array(adminUserSchema) });

/** `getSubscription`'s meters (`services/billing.ts`); a limit is the fair-use cap when unlimited. */
export const adminUsageSchema = z
  .object({
    generationsUsed: z.number(),
    generationsLimit: z.number(),
    coverLettersUsed: z.number(),
    coverLettersLimit: z.number(),
    atsChecksUsed: z.number().optional(),
    atsChecksLimit: z.number().optional(),
    resetsAt: z.string().optional(),
  })
  .passthrough();

/** `inspectUser`: the account, its resume count, the subscription and the last 20 events. */
export const adminUserDetailSchema = adminUserSchema.extend({
  emailVerified: z.boolean().nullish(),
  deletionRequestedAt: z.string().nullish(),
  resumes: z.number().nullish(),
  subscription: z
    .object({ plan: z.string().nullish(), usage: adminUsageSchema.nullish() })
    .passthrough()
    .nullish(),
  securityEvents: z
    .array(z.object({ kind: z.string(), at: z.string(), ip: z.string().nullish() }))
    .nullish(),
});

/** `grantComp`. */
export const adminCompSchema = z.object({ until: z.string() });

const strings = z.array(z.string()).default([]);
const join = (parts: (string | undefined)[], by: string) => parts.filter(Boolean).join(by);
const bullet = (line: string) => `• ${line}`;

/**
 * `readUserResume` answers with the document's `DocumentContent` (`models/resumeContent.ts`). The
 * viewer reads it as plain lines in the printed order. The contact line is left out: the reason
 * covers the document, and the account's address is already on the page.
 */
export const adminResumeContentSchema = z
  .object({
    kind: z.string().optional(),
    headline: z.string().optional(),
    summary: z.string().default(''),
    skills: strings,
    experience: z
      .array(
        z.object({
          title: z.string(),
          company: z.string(),
          location: z.string().optional(),
          period: z.string(),
          bullets: strings,
        }),
      )
      .default([]),
    projects: z
      .array(z.object({ name: z.string(), description: z.string(), bullets: strings }))
      .default([]),
    certifications: strings,
    education: z
      .array(z.object({ degree: z.string(), institution: z.string(), period: z.string() }))
      .default([]),
    links: strings,
    greeting: z.string().default(''),
    paragraphs: strings,
    signoff: z.string().default(''),
  })
  .transform((c): Omit<AdminResumeContent, 'resumeId'> => {
    if (c.kind === 'cover_letter') {
      const lines = [c.greeting, ...c.paragraphs, c.signoff].filter(Boolean);
      return { title: 'Cover letter', sections: [{ heading: 'Letter', lines }] };
    }
    const parts: Record<ResumeSectionKey, string[]> = {
      summary: [c.summary].filter(Boolean),
      skills: c.skills.length ? [c.skills.join(', ')] : [],
      experience: c.experience.flatMap((role) => [
        join([join([role.title, role.company], ', '), role.location, role.period], ' · '),
        ...role.bullets.map(bullet),
      ]),
      projects: c.projects.flatMap((project) => [
        join([project.name, project.description], ': '),
        ...project.bullets.map(bullet),
      ]),
      certifications: c.certifications,
      education: c.education.map((entry) =>
        join([entry.degree, entry.institution, entry.period], ' · '),
      ),
    };
    const sections = [
      { heading: 'Headline', lines: c.headline ? [c.headline] : [] },
      ...RESUME_SECTION_ORDER.map((key) => ({
        heading: RESUME_SECTION_LABEL[key],
        lines: parts[key],
      })),
      { heading: 'Links', lines: c.links },
    ];
    return { title: 'Resume', sections: sections.filter((section) => section.lines.length > 0) };
  });

/**
 * The admin portal's People routes (`packages/server/src/http/routes/adminPeople.ts`, served by
 * `services/admin/people*.ts`): the Users page totals, browsing every account, the detail page and
 * the deletion ledger.
 */

const delta = z.object({ value: z.number(), unit: z.enum(['percent', 'points']) });

/** `userStats`: every figure from real rows; `active30Delta` is null until history covers the window. */
export const adminUserStatsSchema = z.object({
  total: z.number(),
  newLast30: z.number(),
  active30: z.number(),
  active30Delta: delta.nullable(),
  pro: z.number(),
  proNew: z.number(),
  comped: z.number(),
  suspended: z.number(),
  suspendedBy: z.object({ abuse: z.number(), fraud: z.number(), other: z.number() }),
  pendingDeletion: z.number(),
  nextDeletionDueInDays: z.number().nullable(),
});

const rowStatus = z.enum(['active', 'suspended', 'deletion_pending', 'comped', 'unverified']);

/** `browseUsers`: one page of accounts with each row's facts. */
export const adminBrowseRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  plan: z.enum(['free', 'pro']),
  status: rowStatus,
  usage: z.object({ used: z.number(), limit: z.number() }),
  signedUpAt: z.string(),
  lastActiveAt: z.string().nullable(),
  resumes: z.number(),
});

export const adminBrowseSchema = z.object({
  rows: z.array(adminBrowseRowSchema),
  matched: z.number(),
  page: z.number(),
  pages: z.number(),
});

/** `userProfile`: `inspectUser` plus the detail page's own facts. */
export const adminUserProfileSchema = adminUserDetailSchema.extend({
  plan: z.enum(['free', 'pro']),
  rowStatus,
  usageRow: z.object({ used: z.number(), limit: z.number() }),
  lastActiveAt: z.string().nullable(),
  compedUntil: z.string().nullable(),
  billing: z
    .object({
      period: z.enum(['monthly', 'annual']),
      since: z.string(),
      country: z.string(),
      priceMinor: z.number(),
      currency: z.string(),
      renewsAt: z.string().nullable(),
      stripeCustomer: z.string(),
    })
    .nullable(),
  resumeList: z.array(
    z.object({
      id: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
      pages: z.number().nullable(),
      template: z.string().nullable(),
      source: z.string(),
    }),
  ),
  events: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      at: z.string(),
      ip: z.string().nullish(),
      device: z.string().nullable(),
    }),
  ),
  securityEventCount: z.number(),
  adminActions: z.array(
    z.object({
      id: z.string(),
      kind: z.enum([
        'password_reset',
        'content_read',
        'usage_reset',
        'email_changed',
        'suspended',
        'reactivated',
        'comped',
        'deletion_requested',
      ]),
      label: z.string(),
      by: z.string(),
      note: z.string().nullable(),
      at: z.string(),
    }),
  ),
});

/** `listDeletions`: the ledger, newest first. */
export const adminDeletionsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      origin: z.enum(['user', 'admin']),
      requestedAt: z.string(),
      dueAt: z.string(),
      status: z.enum(['purging', 'signed_out', 'scheduled', 'completed']),
      completedAt: z.string().nullable(),
    }),
  ),
});
