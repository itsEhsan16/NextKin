import type { z } from 'zod';

import type {
  AdminDeletionFilter,
  AdminDeletionRequest,
  AdminDeletionStats,
  AdminUsageMeter,
  AdminUserDetail,
  AdminUsersPage,
  AdminUsersQuery,
  AdminUserStats,
} from '../../models/adminPeople';
import {
  adminBrowseSchema,
  adminDeletionsSchema,
  adminUserProfileSchema,
  adminUserStatsSchema,
  type adminUsageSchema,
} from '../../schemas/adminPeople';
import { deletionStatsOf } from '../adminPeopleHelpers';
import type { HttpClient } from './client';

/**
 * The People area's reads and the deletion queue over the admin portal's People routes
 * (`packages/server/src/http/routes/adminPeople.ts`, `services/admin/people*.ts`): the Users page
 * totals, browsing every account, one user's detail page and the deletion ledger. Each answers
 * from real rows; what no row of ours holds stays `null` (a user's sign-in method and MFA live in
 * the identity provider).
 */

/**
 * The first two parts of an address, as the board prints one: "102.89.xx.xx", and for IPv6
 * "2001:db8:xx:xx". An IPv4 address mapped into IPv6 reads as the IPv4 one.
 */
export const maskIp = (ip: string | null | undefined): string | null => {
  const address = ip?.split('/')[0];
  if (!address) return null;
  const v4 = /(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(address);
  if (v4) return `${v4[1]}.${v4[2]}.xx.xx`;
  const groups = address.split(':').filter(Boolean);
  return groups.length ? `${groups.slice(0, 2).join(':')}:xx:xx` : null;
};

/** `security_events.kind`, worded as the board words its events; any other kind reads as is. */
const EVENT: Record<string, string> = {
  sign_up: 'Signed up',
  sign_in: 'Signed in',
  sign_in_failed: 'Failed sign-in',
  sign_out: 'Signed out',
  sign_out_all: 'Signed out everywhere',
  email_changed: 'Email address changed',
  data_export: 'Data export requested',
  deletion_requested: 'Account deletion requested',
};
export const eventLabel = (kind: string) =>
  EVENT[kind] ?? kind.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/**
 * This month's meters, labelled as the board's Usage card (406:2598–406:2620). The server's
 * interview figure is every set the user has made against a per-resume cap, not this month's use,
 * so it isn't drawn as a meter.
 */
export function metersOf(usage: z.infer<typeof adminUsageSchema>): AdminUsageMeter[] {
  const meters: AdminUsageMeter[] = [
    {
      key: 'generation',
      label: 'Generations',
      description: 'Resume tailoring and rewrites',
      used: usage.generationsUsed,
      limit: usage.generationsLimit,
    },
    {
      key: 'cover_letter',
      label: 'Cover letters',
      description: 'Generated or rewritten',
      used: usage.coverLettersUsed,
      limit: usage.coverLettersLimit,
    },
  ];
  if (usage.atsChecksUsed !== undefined && usage.atsChecksLimit !== undefined) {
    meters.push({
      key: 'ats_check',
      label: 'ATS checks',
      description: 'Resume scored against a job',
      used: usage.atsChecksUsed,
      limit: usage.atsChecksLimit,
    });
  }
  return meters;
}

const userPath = (id: string) => `/admin/people/users/${encodeURIComponent(id)}`;

export const fetchUserStats = async (http: HttpClient): Promise<AdminUserStats> =>
  adminUserStatsSchema.parse(await http.request('/admin/people/stats'));

/**
 * A page of accounts. The server pages by sign-up date; with no sort chosen it lists the newest
 * first, which is the order the board's rows are drawn in.
 */
export async function fetchUsersPage(
  http: HttpClient,
  query: AdminUsersQuery,
): Promise<AdminUsersPage> {
  const raw = adminBrowseSchema.parse(
    await http.request('/admin/people/users', {
      query: {
        filter: query.filter,
        q: query.q.trim(),
        sort: query.sort ?? 'desc',
        page: query.page,
      },
    }),
  );
  return {
    rows: raw.rows.map((row) => ({ ...row, name: row.name || row.email })),
    matched: raw.matched,
    page: raw.page,
    pages: raw.pages,
    served: true,
  };
}

export async function fetchUser(http: HttpClient, id: string): Promise<AdminUserDetail> {
  const raw = adminUserProfileSchema.parse(await http.request(userPath(id)));
  const usage = raw.subscription?.usage ?? null;
  const events = raw.events.map((event) => ({
    id: event.id,
    event: eventLabel(event.kind),
    result: event.kind.includes('fail') ? ('failed' as const) : ('success' as const),
    ip: maskIp(event.ip),
    device: event.device ?? '—',
    at: event.at,
  }));
  return {
    id: raw.id,
    name: raw.name || raw.email,
    email: raw.email,
    plan: raw.plan,
    status: raw.rowStatus,
    usage: raw.usageRow,
    signedUpAt: raw.createdAt,
    lastActiveAt: raw.lastActiveAt,
    resumes: raw.resumeList.length,
    emailVerified: raw.emailVerified ?? false,
    billing: raw.billing,
    compedUntil: raw.compedUntil,
    // Held by the identity provider, not in our rows.
    signInMethod: null,
    mfa: null,
    deletionRequestedAt: raw.deletionRequestedAt ?? null,
    meters: usage && metersOf(usage),
    usageResetsAt: usage?.resetsAt ?? null,
    resumeList: raw.resumeList,
    securityEvents: events,
    securityEventCount: raw.securityEventCount,
    adminActions: raw.adminActions,
  };
}

export async function fetchDeletions(
  http: HttpClient,
  filter: AdminDeletionFilter,
): Promise<AdminDeletionRequest[]> {
  return adminDeletionsSchema.parse(
    await http.request('/admin/people/deletions', { query: { filter } }),
  ).data;
}

/** The deletion page's cards, worked out from every request the ledger holds (408:2843). */
export const fetchDeletionStats = async (http: HttpClient): Promise<AdminDeletionStats> =>
  deletionStatsOf(await fetchDeletions(http, 'all'));

export async function startPurge(
  http: HttpClient,
  requestId: string,
  input: { reason: string },
): Promise<void> {
  await http.request(`/admin/people/deletions/${encodeURIComponent(requestId)}/process`, {
    body: { reason: input.reason.trim() },
  });
}
