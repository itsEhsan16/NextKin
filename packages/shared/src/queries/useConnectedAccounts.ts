import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ConnectedAccount, ConnectedProvider } from '../models';
import { repos } from '../repos';

import { qk } from './keys';

/** The sign-in accounts V2 §7.1 links through Cognito: Google, on the web Settings page. */
export function useConnectedAccounts() {
  return useQuery({
    queryKey: qk.user.connectedAccounts(),
    queryFn: () => repos.user.listConnectedAccounts(),
  });
}

/**
 * Linking goes through the provider's own sign-in (V2 §7.1), so it is never instant and the row
 * waits for the answer rather than guessing it: `isPending` is its "Connecting…". The list the
 * answer carries replaces the cache. In the real client that sign-in is a redirect, so this may
 * change shape with `UserRepo.connectAccount`.
 */
function useConnectionChange(change: (provider: ConnectedProvider) => Promise<ConnectedAccount[]>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    onSuccess: (accounts) => queryClient.setQueryData(qk.user.connectedAccounts(), accounts),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.user.connectedAccounts() }),
  });
}

export function useConnectAccount() {
  return useConnectionChange((provider) => repos.user.connectAccount(provider));
}

export function useDisconnectAccount() {
  return useConnectionChange((provider) => repos.user.disconnectAccount(provider));
}
