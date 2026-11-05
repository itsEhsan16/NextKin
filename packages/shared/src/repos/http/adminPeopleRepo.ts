import { adminCompSchema, adminResumeContentSchema } from '../../schemas/adminPeople';
import type { AdminPeopleRepo } from '../adminPeopleRepo';
import { MIN_CONTENT_REASON } from '../adminPeopleHelpers';
import {
  fetchDeletions,
  fetchDeletionStats,
  fetchUser,
  fetchUserStats,
  fetchUsersPage,
  startPurge,
} from './adminPeopleOps';
import { createStaffOps } from './adminStaffOps';
import type { HttpClient } from './client';

/**
 * `AdminPeopleRepo` over `/api/v1/admin/*`: the account actions in `routes/admin.ts`
 * (`services/admin/users.ts`) and the portal's People routes in `routes/adminPeople.ts`
 * (`services/admin/people*.ts`, read in `adminPeopleOps.ts`); the responses' shapes are in
 * `schemas/adminPeople.ts`. Every method answers from the server: what it doesn't serve comes back
 * as `null` or refuses, and never as fixture data (`toreview.md` §171.4, §171.13).
 *
 * Served: the Users page totals, browsing every account (any filter, any search length), one user
 * with plan, billing, resumes' metadata, security events and staff actions, suspend, reactivate,
 * password reset, comp, delete, the reason-gated resume read, role changes and the deletion queue.
 * Not served: a user's sign-in method and MFA, which the identity provider holds.
 */

const path = (id: string) => `/admin/users/${encodeURIComponent(id)}`;

/** The suspend and reactivate body: the route is `.strict()`, so a blank note isn't sent. */
const statusBody = (input: { reason: string; note: string }) => ({
  reason: input.reason,
  ...(input.note.trim() ? { note: input.note.trim() } : {}),
});

export function createHttpAdminPeopleRepo(http: HttpClient): AdminPeopleRepo {
  return {
    userStats: () => fetchUserStats(http),

    listUsers: (query) => fetchUsersPage(http, query),

    getUser: (id) => fetchUser(http, id),

    suspendUser: async (id, input) => {
      await http.request(`${path(id)}/suspend`, { body: statusBody(input) });
    },

    reactivateUser: async (id, input) => {
      await http.request(`${path(id)}/reactivate`, { body: statusBody(input) });
    },

    sendPasswordReset: async (id) => {
      await http.request(`${path(id)}/password-reset`, { method: 'POST' });
    },

    // The hook hands over its own arguments (`id` too) and the route is strict: send only the two
    // fields it takes.
    compPro: async (id, input) =>
      adminCompSchema.parse(
        await http.request(`${path(id)}/comp`, {
          body: { months: input.months, reason: input.reason },
        }),
      ),

    deleteUser: async (id, input) => {
      await http.request(`${path(id)}/delete`, { body: { reason: input.reason } });
    },

    readResume: async (id, resumeId, input) => {
      if (input.reason.trim().length < MIN_CONTENT_REASON) {
        throw new Error('Say why you need to read this resume.');
      }
      const reason = [input.reason.trim(), input.caseRef.trim()].filter(Boolean).join(' · ');
      const raw = await http.request(`${path(id)}/resumes/${encodeURIComponent(resumeId)}`, {
        query: { reason },
      });
      return { resumeId, ...adminResumeContentSchema.parse(raw ?? {}) };
    },

    // Staff & roles: the server's own staff accounts (toreview §171.13).
    ...createStaffOps(http),

    // The ledger of deletion requests (0052): deleting signs the account out at once, and the
    // daily purge, or "Process now", removes what is left.
    deletionStats: () => fetchDeletionStats(http),
    listDeletions: (filter) => fetchDeletions(http, filter),
    processDeletion: (requestId, input) => startPurge(http, requestId, input),
  };
}
