import type {
  AdminDeletionRequest,
  AdminDeletionStats,
  AdminUserRow,
  AdminUsersQuery,
} from '../models/adminPeople';

/**
 * The People area's pure helpers, shared by the mock and HTTP repositories. Nothing here reads
 * fixtures, so the HTTP repository can use them without the mock in its import graph.
 */

export const ADMIN_USERS_PAGE_SIZE = 20;
export const ADMIN_DELETIONS_PAGE_SIZE = 6;
export const MIN_CONTENT_REASON = 10;
const DAY = 86_400_000;

export const matchesUser = (row: AdminUserRow, q: string) => {
  const needle = q.trim().toLowerCase();
  return (
    !needle || [row.name, row.email, row.id].some((field) => field.toLowerCase().includes(needle))
  );
};

/** Rows by signed-up date, or left in the source's order when `sort` is `null`. */
export const bySignup = (sort: AdminUsersQuery['sort']) => (a: AdminUserRow, b: AdminUserRow) =>
  sort === null
    ? 0
    : (Date.parse(a.signedUpAt) - Date.parse(b.signedUpAt)) * (sort === 'asc' ? 1 : -1);

/** Days between two instants, whole and rounded up: "3 days" left. */
export const daysBetween = (from: number, to: number) => Math.ceil((to - from) / DAY);

/**
 * The deletion page's cards, worked out from every request held (408:2843). An open request past
 * its due date is overdue, never "due soon", and the next due date is one still ahead.
 */
export function deletionStatsOf(
  requests: AdminDeletionRequest[],
  now = Date.now(),
): AdminDeletionStats {
  const open = requests.filter((r) => r.status !== 'completed');
  const done = requests.filter((r) => r.completedAt !== null);
  const overdue = open.filter((r) => Date.parse(r.dueAt) < now);
  const ahead = open.filter((r) => Date.parse(r.dueAt) >= now);
  const dueSoon = ahead.filter((r) => daysBetween(now, Date.parse(r.dueAt)) <= 7);
  const byDue = [...ahead].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const byAge = [...open].sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt));
  const took = done.map((r) => (Date.parse(r.completedAt!) - Date.parse(r.requestedAt)) / DAY);
  const inside = took.filter((days) => days <= 30).length;
  return {
    open: open.length,
    oldestOpenAt: byAge[0]?.requestedAt ?? null,
    overdue: overdue.length,
    dueIn7Days: dueSoon.length,
    nextDueAt: byDue[0]?.dueAt ?? null,
    completed30: inside,
    completedPastLimit: took.length - inside,
    averageDays: took.length
      ? Math.round((took.reduce((s, d) => s + d, 0) / took.length) * 10) / 10
      : null,
  };
}
