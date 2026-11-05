import {
  SUSPEND_REASONS,
  type AdminDeletionRequest,
  type AdminStaffMember,
  type AdminUserAction,
  type AdminUserDetail,
  type AdminUserRow,
  type AdminUsersQuery,
  type AdminUserStats,
  type AdminUserStatus,
  type SuspendReason,
} from '../models/adminPeople';
import { simulate } from '../mock';
import { MockError } from '../mock/delay';
import {
  adminDeletionFixture,
  adminResumeContentFixture,
  adminStaffFixture,
  adminUserDetailFixture,
  adminUsersFixture,
  adminUserStatsFixture,
} from '../mock/fixtures/adminPeople';

import { auditRef, recordAdminAudit } from './adminAuditLog';
import { onAdminMockReset } from './adminMockReset';
import {
  ADMIN_USERS_PAGE_SIZE,
  bySignup,
  deletionStatsOf,
  matchesUser,
  MIN_CONTENT_REASON,
} from './adminPeopleHelpers';
import type { AdminPeopleRepo } from './adminPeopleRepo';
import { clone } from './state';

/** The mock's temporary password: the shape the server makes, never a real credential. */
const mockTemporaryPassword = () =>
  Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 6).padEnd(4, 'x')).join('-');

const DAY = 86_400_000;
/** The signed-in staff member on the mock (a Super Admin, `stf_ehsan`). */
const ME = 'Ehsan';

const FILTER: Record<AdminUsersQuery['filter'], (row: AdminUserRow) => boolean> = {
  all: () => true,
  free: (row) => row.plan === 'free',
  pro: (row) => row.plan === 'pro',
  suspended: (row) => row.status === 'suspended',
  deletion_pending: (row) => row.status === 'deletion_pending',
};

/** Empty mode: a platform with no accounts yet, so nothing to compare a change against. */
const EMPTY_USER_STATS: AdminUserStats = {
  total: 0,
  newLast30: 0,
  active30: 0,
  active30Delta: null,
  pro: 0,
  proNew: 0,
  comped: 0,
  suspended: 0,
  suspendedBy: { abuse: 0, fraud: 0, other: 0 },
  pendingDeletion: 0,
  nextDeletionDueInDays: null,
};

/** "Abuse: spam runs from this account", or the reason's label alone without a note. */
const reasonNote = (reason: SuspendReason, note: string) => {
  const label = SUSPEND_REASONS.find((r) => r.id === reason)?.label ?? reason;
  return note.trim() ? `${label}: ${note.trim()}` : label;
};

/**
 * Where an account stands once a suspension lifts, the most pressing first (404:614): a pending
 * deletion, then a comp still running, then an unverified email.
 */
const statusAfterSuspension = (user: AdminUserDetail): AdminUserStatus => {
  if (user.deletionRequestedAt) return 'deletion_pending';
  if (user.compedUntil && Date.parse(user.compedUntil) > Date.now()) return 'comped';
  return user.emailVerified ? 'active' : 'unverified';
};

type State = {
  users: AdminUserRow[];
  details: Map<string, AdminUserDetail>;
  staff: AdminStaffMember[];
  deletions: AdminDeletionRequest[];
};

const fresh = (): State => ({
  users: clone(adminUsersFixture),
  details: new Map(),
  staff: clone(adminStaffFixture),
  deletions: clone(adminDeletionFixture),
});

/**
 * The People area on fixtures. Staff actions change the session's state, as they would on the
 * server: a suspended user shows Suspended everywhere, a processed request starts purging. Empty
 * mode has no users, no staff and no requests, and the cards count none.
 */
export function createMockAdminPeopleRepo(): AdminPeopleRepo {
  let state = fresh();
  onAdminMockReset(() => {
    state = fresh();
  });

  const detail = (id: string): AdminUserDetail => {
    const row = state.users.find((user) => user.id === id);
    if (!row) throw new MockError('NOT_FOUND', 'No such user');
    let found = state.details.get(id);
    if (!found) {
      found = adminUserDetailFixture(row);
      state.details.set(id, found);
    }
    return found;
  };
  const update = (
    id: string,
    patch: Partial<AdminUserDetail>,
    action?: Omit<AdminUserAction, 'id' | 'at' | 'by'>,
  ) => {
    const current = detail(id);
    Object.assign(current, patch);
    state.users = state.users.map((row) => (row.id === id ? { ...row, ...pickRow(patch) } : row));
    if (action && current.adminActions) {
      current.adminActions = [
        { ...action, id: `act_${Date.now()}`, by: ME, at: new Date().toISOString() },
        ...current.adminActions,
      ];
    }
  };

  return {
    userStats: () =>
      simulate(() => clone(adminUserStatsFixture), { empty: () => clone(EMPTY_USER_STATS) }),

    listUsers: (query) =>
      simulate(
        () => {
          const matched = state.users
            .filter(FILTER[query.filter])
            .filter((row) => matchesUser(row, query.q))
            .sort(bySignup(query.sort));
          const pages = Math.max(1, Math.ceil(matched.length / ADMIN_USERS_PAGE_SIZE));
          const page = Math.min(Math.max(1, query.page), pages);
          const rows = matched.slice(
            (page - 1) * ADMIN_USERS_PAGE_SIZE,
            page * ADMIN_USERS_PAGE_SIZE,
          );
          return { rows: clone(rows), matched: matched.length, page, pages, served: true };
        },
        { empty: () => ({ rows: [], matched: 0, page: 1, pages: 1, served: true }) },
      ),

    getUser: (id) => simulate(() => clone(detail(id))),

    suspendUser: (id, input) =>
      simulate(() => {
        update(
          id,
          { status: 'suspended' },
          {
            kind: 'suspended',
            label: 'Account suspended',
            note: reasonNote(input.reason, input.note),
          },
        );
        recordAdminAudit(
          'Suspended an account',
          'user',
          auditRef('user', id),
          reasonNote(input.reason, input.note),
        );
      }),

    reactivateUser: (id, input) =>
      simulate(() => {
        update(
          id,
          { status: statusAfterSuspension(detail(id)) },
          {
            kind: 'reactivated',
            label: 'Account reactivated',
            note: reasonNote(input.reason, input.note),
          },
        );
        recordAdminAudit(
          'Reactivated an account',
          'user',
          auditRef('user', id),
          reasonNote(input.reason, input.note),
        );
      }),

    sendPasswordReset: (id) =>
      simulate(() => {
        const current = detail(id);
        // The board's own security events list a staff reset with the result Admin (406:2525).
        current.securityEvents = [
          {
            id: `sec_${Date.now()}`,
            event: 'Password reset email sent',
            result: 'admin',
            ip: null,
            device: `Requested by ${ME}`,
            at: new Date().toISOString(),
          },
          ...current.securityEvents,
        ];
        current.securityEventCount += 1;
        update(id, {}, { kind: 'password_reset', label: 'Password reset email sent', note: null });
        recordAdminAudit('Sent a password reset', 'user', auditRef('user', id));
      }),

    compPro: (id, input) =>
      simulate(() => {
        const until = new Date(Date.now() + input.months * 30 * DAY).toISOString();
        const status = detail(id).status;
        // A comp never lifts a suspension or a pending deletion: those stay the status shown.
        const next = status === 'active' || status === 'unverified' ? 'comped' : status;
        update(
          id,
          { plan: 'pro', status: next, compedUntil: until },
          {
            kind: 'comped',
            label: `Comped Pro for ${input.months} month${input.months === 1 ? '' : 's'}`,
            note: input.reason,
          },
        );
        recordAdminAudit(
          'Granted comp',
          'user',
          auditRef('user', id),
          `Pro · ${input.months} months · ${input.reason}`,
        );
        return { until };
      }),

    deleteUser: (id, input) =>
      simulate(() => {
        const now = new Date();
        update(
          id,
          { status: 'deletion_pending', deletionRequestedAt: now.toISOString() },
          { kind: 'deletion_requested', label: 'Account deletion requested', note: input.reason },
        );
        state.deletions = [
          {
            id: `del_${id.slice(-4)}`,
            userId: id,
            origin: 'admin',
            requestedAt: now.toISOString(),
            dueAt: new Date(now.getTime() + 30 * DAY).toISOString(),
            status: 'signed_out',
            completedAt: null,
          },
          ...state.deletions,
        ];
        recordAdminAudit('Requested deletion', 'user', auditRef('user', id), input.reason);
      }),

    readResume: (id, resumeId, input) =>
      simulate(() => {
        if (input.reason.trim().length < MIN_CONTENT_REASON)
          throw new MockError('VALIDATION', 'Say why you need to read this resume.');
        const user = detail(id);
        if (!user.resumeList?.some((resume) => resume.id === resumeId))
          throw new MockError('NOT_FOUND', 'No such resume');
        const note = input.caseRef.trim() ? `ticket ${input.caseRef.trim()}` : input.reason.trim();
        update(id, {}, { kind: 'content_read', label: 'Viewed resume content', note });
        recordAdminAudit('Opened resume content', 'resume', auditRef('resume', resumeId), note);
        return adminResumeContentFixture(user.name, resumeId);
      }),

    listStaff: () => simulate(() => clone(state.staff), { empty: () => [] }),

    setStaffRole: (id, role) =>
      simulate(() => {
        if (id === 'stf_ehsan') throw new MockError('CONFLICT', 'You can’t change your own role.');
        state.staff = state.staff.map((member) =>
          member.id === id ? { ...member, role } : member,
        );
        recordAdminAudit('Changed role', 'staff', auditRef('staff', id), role);
      }),

    inviteStaff: (input) =>
      simulate(() => {
        const email = input.email.trim().toLowerCase();
        if (state.staff.some((member) => member.email.toLowerCase() === email)) {
          throw new MockError('CONFLICT', `${input.email.trim()} is already on staff.`);
        }
        const member: AdminStaffMember = {
          id: `stf_${Date.now()}`,
          ...input,
          mfa: 'none',
          // They haven't signed in yet.
          lastActiveAt: null,
          status: 'invited',
        };
        state.staff = [...state.staff, member];
        recordAdminAudit('Invited staff', 'staff', auditRef('staff', member.id), member.role);
        return { member: clone(member), temporaryPassword: mockTemporaryPassword(), emailed: true };
      }),

    resetStaff: (id) =>
      simulate(() => {
        const member = state.staff.find((entry) => entry.id === id);
        if (!member) throw new MockError('NOT_FOUND', 'No such staff member');
        state.staff = state.staff.map((entry) =>
          entry.id === id ? { ...entry, mfa: 'none' as const, status: 'invited' as const } : entry,
        );
        recordAdminAudit('Reset staff sign-in', 'staff', auditRef('staff', id), member.role);
        return { temporaryPassword: mockTemporaryPassword(), emailed: true };
      }),

    deletionStats: () =>
      simulate(() => deletionStatsOf(state.deletions), { empty: () => deletionStatsOf([]) }),

    listDeletions: (filter) =>
      simulate(
        () =>
          clone(
            state.deletions.filter((r) =>
              filter === 'all'
                ? true
                : filter === 'open'
                  ? r.status !== 'completed'
                  : r.status === 'completed',
            ),
          ),
        { empty: () => [] },
      ),

    processDeletion: (requestId, input) =>
      simulate(() => {
        if (input.reason.trim().length < 3) throw new MockError('VALIDATION', 'Say why.');
        state.deletions = state.deletions.map((r) =>
          r.id === requestId ? { ...r, status: 'purging' } : r,
        );
        recordAdminAudit('Processed deletion', 'user', auditRef('user', requestId), input.reason);
      }),
  };
}

function pickRow(patch: Partial<AdminUserDetail>): Partial<AdminUserRow> {
  const row: Partial<AdminUserRow> = {};
  if (patch.status) row.status = patch.status;
  if (patch.plan) row.plan = patch.plan;
  return row;
}
