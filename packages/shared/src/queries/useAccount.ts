import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DataExportStatus, User } from '../models';
import { repos } from '../repos';

import { qk } from './keys';

/** How often the settings row asks whether the archive has finished building (V2 §8.5). */
const DATA_EXPORT_POLL_MS = 1000;

/**
 * The optimistic trio for the account identity fields. Each edit form closes on save, so the
 * row and the avatar behind it must already carry the new value; the server's `User` overwrites
 * the guess on success and the settle sweeps `user/me`.
 */
function accountMutation<TVars>(
  mutationFn: (vars: TVars) => Promise<User>,
  apply: (previous: User, vars: TVars) => User,
) {
  return function useAccountWrite() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn,
      onMutate: async (vars: TVars) => {
        // First, always: an in-flight `user/me` refetch would otherwise land on top of the write.
        await queryClient.cancelQueries({ queryKey: qk.user.me() });
        const previous = queryClient.getQueryData<User>(qk.user.me());
        queryClient.setQueryData<User>(qk.user.me(), (old) => (old ? apply(old, vars) : old));
        return { previous };
      },
      onError: (_error, _vars, context) => {
        if (context?.previous) queryClient.setQueryData(qk.user.me(), context.previous);
      },
      onSuccess: (user) => {
        queryClient.setQueryData(qk.user.me(), user);
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: qk.user.me() }),
    });
  };
}

/** Personal info from the edit-account form (V2 §7.3). */
export const useUpdateName = accountMutation(
  (name: { firstName: string; lastName: string }) => repos.user.updateName(name),
  (previous, { firstName, lastName }) => ({
    ...previous,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
  }),
);

/** Re-verification is the server's business; the row shows the new address immediately. */
export const useUpdateEmail = accountMutation(
  (email: string) => repos.user.updateEmail(email),
  (previous, email) => ({ ...previous, email: email.trim() }),
);

/** The picked local URI renders straight away; the real API swaps in the uploaded URL. */
export const useUpdateAvatar = accountMutation(
  (uri: string) => repos.user.updateAvatar(uri),
  (previous, uri) => ({ ...previous, avatarUrl: uri }),
);

/**
 * V2 §7.1 / §8.4. Only Cognito ever holds a password, so its rejection is the form's error state.
 * Success moves the password's age and signs every other device out, so the security cards
 * refetch.
 */
export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      repos.user.changePassword(current, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.user.security() }),
  });
}

/** Revokes every other session (V2 §7.1). This device stays signed in; only the device list moves. */
export function useSignOutEverywhere() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => repos.user.signOutEverywhere(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.user.security() }),
  });
}

/**
 * When the password last changed, whether two-factor is on, and the signed-in devices (V2 §7.1;
 * the web Settings board, Figma 254:522-590).
 */
export function useAccountSecurity() {
  return useQuery({
    queryKey: qk.user.security(),
    queryFn: () => repos.user.getSecurity(),
  });
}

/**
 * Irreversible account deletion (V2 §8.5). Deliberately leaves the caches alone: the screen ends
 * the session with `useResetSession` once the confirmation resolves, which clears them all.
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => repos.user.deleteAccount(),
  });
}

/** The audit trail behind the dashboard's "Activities" counter (V2 §7.2). */
export function useActivity() {
  return useQuery({
    queryKey: qk.user.activity(),
    queryFn: () => repos.user.listActivity(),
  });
}

/**
 * The data-export row's state (V2 §8.5). While the archive builds, this follows the server's own
 * timer by polling rather than by subscribing — there is no stream behind an export.
 *
 * v5 hands `refetchInterval` the Query, not the data, so the state is read off `query.state`.
 */
export function useDataExport() {
  return useQuery({
    queryKey: qk.user.dataExport(),
    queryFn: () => repos.user.getDataExport(),
    refetchInterval: (query) =>
      query.state.data?.status === 'preparing' ? DATA_EXPORT_POLL_MS : false,
  });
}

/**
 * Asks for the archive. Write-through: the returned status is what starts the poll above, so it
 * is seeded into the cache the moment it arrives rather than guessed at on tap.
 */
export function useRequestDataExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => repos.user.requestDataExport(),
    onSuccess: (status: DataExportStatus) => {
      queryClient.setQueryData(qk.user.dataExport(), status);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.user.dataExport() }),
  });
}
