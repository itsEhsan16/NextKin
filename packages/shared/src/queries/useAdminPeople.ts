import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AdminRole } from '../models/admin';
import type { AdminDeletionFilter, AdminUsersQuery, SuspendReason } from '../models/adminPeople';
import { repos } from '../repos';

/**
 * Query hooks for the admin portal's People area (Figma 404:614–408:2745): users, one user, staff
 * and roles, deletion requests. Keys sit under `['admin', 'people']`, so `qk.admin.all` sweeps
 * them too. Every action refreshes what it changed (the user, the list, the queues), so a
 * suspended user reads Suspended everywhere at once.
 */

export const peopleKeys = {
  all: ['admin', 'people'] as const,
  userStats: () => ['admin', 'people', 'user-stats'] as const,
  users: (query: AdminUsersQuery) => ['admin', 'people', 'users', query] as const,
  user: (id: string) => ['admin', 'people', 'user', id] as const,
  staff: () => ['admin', 'people', 'staff'] as const,
  deletionStats: () => ['admin', 'people', 'deletion-stats'] as const,
  deletions: (filter: AdminDeletionFilter) => ['admin', 'people', 'deletions', filter] as const,
};

export function useAdminUserStats() {
  return useQuery({
    queryKey: peopleKeys.userStats(),
    queryFn: () => repos.adminPeople.userStats(),
  });
}

/** One page of users. The last page stays on screen while the next arrives. */
export function useAdminUsers(query: AdminUsersQuery) {
  return useQuery({
    queryKey: peopleKeys.users(query),
    queryFn: () => repos.adminPeople.listUsers(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUser(id: string) {
  return useQuery({ queryKey: peopleKeys.user(id), queryFn: () => repos.adminPeople.getUser(id) });
}

/** Wraps a staff action so it refreshes the People area and the shell's queue counts. */
function usePeopleAction<TArgs, TResult>(run: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => client.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export const useSuspendUser = () =>
  usePeopleAction((args: { id: string; reason: SuspendReason; note: string; notify: boolean }) =>
    repos.adminPeople.suspendUser(args.id, args),
  );

export const useReactivateUser = () =>
  usePeopleAction((args: { id: string; reason: SuspendReason; note: string }) =>
    repos.adminPeople.reactivateUser(args.id, args),
  );

export const useSendPasswordReset = () =>
  usePeopleAction((id: string) => repos.adminPeople.sendPasswordReset(id));

export const useCompPro = () =>
  usePeopleAction((args: { id: string; months: number; reason: string }) =>
    repos.adminPeople.compPro(args.id, args),
  );

export const useDeleteUser = () =>
  usePeopleAction((args: { id: string; reason: string }) =>
    repos.adminPeople.deleteUser(args.id, args),
  );

/**
 * Reason-gated: nothing is cached. The mutation is dropped from the cache as soon as nothing
 * observes it (`gcTime: 0`), and the viewer calls `reset()` when it closes, so closing it leaves
 * no copy behind.
 */
export function useReadResume() {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (args: { id: string; resumeId: string; reason: string; caseRef: string }) =>
      repos.adminPeople.readResume(args.id, args.resumeId, args),
    onSuccess: (_content, args) => client.invalidateQueries({ queryKey: peopleKeys.user(args.id) }),
  });
}

export function useAdminStaff() {
  return useQuery({ queryKey: peopleKeys.staff(), queryFn: () => repos.adminPeople.listStaff() });
}

export const useSetStaffRole = () =>
  usePeopleAction((args: { id: string; role: AdminRole }) =>
    repos.adminPeople.setStaffRole(args.id, args.role),
  );

export const useInviteStaff = () =>
  usePeopleAction((args: { name: string; email: string; role: AdminRole }) =>
    repos.adminPeople.inviteStaff(args),
  );

/** Staff & roles › Reset sign-in: a new temporary password, shown once. */
export const useResetStaff = () => usePeopleAction((id: string) => repos.adminPeople.resetStaff(id));

export function useAdminDeletionStats() {
  return useQuery({
    queryKey: peopleKeys.deletionStats(),
    queryFn: () => repos.adminPeople.deletionStats(),
  });
}

export function useAdminDeletions(filter: AdminDeletionFilter) {
  return useQuery({
    queryKey: peopleKeys.deletions(filter),
    queryFn: () => repos.adminPeople.listDeletions(filter),
    placeholderData: keepPreviousData,
  });
}

export const useProcessDeletion = () =>
  usePeopleAction((args: { id: string; reason: string }) =>
    repos.adminPeople.processDeletion(args.id, args),
  );
