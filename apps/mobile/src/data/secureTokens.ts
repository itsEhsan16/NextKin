import * as SecureStore from 'expo-secure-store';

import type { TokenStore } from '@nextkin/shared/repos';

/**
 * Where the mobile app keeps its session tokens (ImBackendImplementationPlan P5-08): the device
 * keychain / keystore through expo-secure-store, which runs in Expo Go. One entry holds the
 * access token, the rotating refresh token and the expiry — well under the ~2 KB SecureStore
 * advises per value (an ES256 access token is about 600 bytes). A memory copy saves a keychain
 * read on every request.
 */
const KEY = 'nextkin.session.tokens';

let cached: Awaited<ReturnType<TokenStore['get']>> | undefined;

export const secureTokens: TokenStore = {
  async get() {
    if (cached !== undefined) return cached;
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      cached = raw ? (JSON.parse(raw) as NonNullable<typeof cached>) : null;
    } catch {
      cached = null;
    }
    return cached;
  },
  async set(tokens) {
    cached = tokens;
    try {
      if (tokens) await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
      else await SecureStore.deleteItemAsync(KEY);
    } catch {
      // A keychain failure leaves the session in memory only: signed in until the app restarts.
    }
  },
};
