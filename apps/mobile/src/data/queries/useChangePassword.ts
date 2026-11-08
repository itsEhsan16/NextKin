import { useMutation, useQueryClient } from '@tanstack/react-query';

import { qk, useChangePassword as useServerChangePassword } from '@nextkin/shared/queries';

import { clerk } from '../clerkSession';
import { USES_CLERK } from '../dataSource';
import { fromClerk } from './useClerkAuth';

/**
 * Changing the password (V2 §7.1). On Clerk (toreview §173) the password is Clerk's, so it changes
 * there; the server's `/auth/password/change` refuses under Clerk. Same mutation surface, so the
 * account screen is unchanged. Other devices stay signed in, as the server's change leaves them.
 */
function useClerkChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ current, next }: { current: string; next: string }) => {
      const user = clerk().user;
      if (!user)
        throw { code: 'UNAUTHENTICATED', message: 'Sign in again to change your password.' };
      await user
        .updatePassword({
          currentPassword: current,
          newPassword: next,
          signOutOfOtherSessions: false,
        })
        .catch((error: unknown) => {
          throw fromClerk(error);
        });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.user.security() }),
  });
}

export const useChangeSignInPassword = USES_CLERK
  ? useClerkChangePassword
  : useServerChangePassword;
