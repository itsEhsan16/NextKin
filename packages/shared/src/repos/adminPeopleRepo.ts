import type { AdminRole } from '../models/admin';
import type {
  AdminDeletionFilter,
  AdminDeletionRequest,
  AdminDeletionStats,
  AdminResumeContent,
  AdminStaffMember,
  StaffInvite,
  AdminUserDetail,
  AdminUsersPage,
  AdminUsersQuery,
  AdminUserStats,
  SuspendReason,
} from '../models/adminPeople';

export {
  ADMIN_DELETIONS_PAGE_SIZE,
  ADMIN_USERS_PAGE_SIZE,
  bySignup,
  daysBetween,
  deletionStatsOf,
  matchesUser,
  MIN_CONTENT_REASON,
} from './adminPeopleHelpers';
export { createMockAdminPeopleRepo } from './adminPeopleMockRepo';

/**
 * The admin portal's People area (Figma 404:614–408:2745). A method returning `null` means the
 * source doesn't serve it yet; the screen says "Not connected yet" there.
 */
export interface AdminPeopleRepo {
  userStats(): Promise<AdminUserStats | null>;
  listUsers(query: AdminUsersQuery): Promise<AdminUsersPage>;
  getUser(id: string): Promise<AdminUserDetail>;
  suspendUser(
    id: string,
    input: { reason: SuspendReason; note: string; notify: boolean },
  ): Promise<void>;
  reactivateUser(id: string, input: { reason: SuspendReason; note: string }): Promise<void>;
  sendPasswordReset(id: string): Promise<void>;
  compPro(id: string, input: { months: number; reason: string }): Promise<{ until: string }>;
  deleteUser(id: string, input: { reason: string }): Promise<void>;
  /** Reason-gated and audited: the reason must say why, in at least ten characters. */
  readResume(
    id: string,
    resumeId: string,
    input: { reason: string; caseRef: string },
  ): Promise<AdminResumeContent>;
  listStaff(): Promise<AdminStaffMember[] | null>;
  setStaffRole(id: string, role: AdminRole): Promise<void>;
  /**
   * Invites a member with a temporary password, emailed to them and shown here once; their first
   * sign-in sets up an authenticator and replaces it (toreview §171.13).
   */
  inviteStaff(input: { name: string; email: string; role: AdminRole }): Promise<StaffInvite>;
  /** A new temporary password and no authenticator: the member sets both up again at sign-in. */
  resetStaff(id: string): Promise<{ temporaryPassword: string; emailed: boolean }>;
  deletionStats(): Promise<AdminDeletionStats | null>;
  listDeletions(filter: AdminDeletionFilter): Promise<AdminDeletionRequest[] | null>;
  processDeletion(requestId: string, input: { reason: string }): Promise<void>;
}
