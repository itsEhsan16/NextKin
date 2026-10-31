import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/**
 * Follows the phone's connection, for the offline note and for refreshing when it comes back. A
 * state it isn't sure of yet counts as online: a wrong "you're offline" is worse than a request
 * that fails and says so. Only `isConnected`: the reachability check would ping a third party.
 */
export function watchConnection(): void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
  );
}
