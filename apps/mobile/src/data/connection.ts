import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

/**
 * Follows the phone's connection, for the offline note and for refreshing when it comes back. A
 * state it isn't sure of yet counts as online: a wrong "you're offline" is worse than a request
 * that fails and says so. Only `isConnected`: the reachability check would ping a third party.
 */
export function watchConnection(): void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
  );
  // React Native has no window focus, so TanStack thought the app was always in front and kept
  // every `refetchInterval` poll running in the background (§196). Following the app's state,
  // polls pause while it is backgrounded; the run pollers in the repos read the same flag.
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
    return () => sub.remove();
  });
}
