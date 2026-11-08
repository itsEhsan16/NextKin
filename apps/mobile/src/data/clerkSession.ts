import { getClerkInstance } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';

import { ApiError, type RefreshOutcome, type TokenStore } from '@nextkin/shared/repos';

/**
 * Mobile sign-in through Clerk (toreview §173; the web's half is §169). Clerk owns the account:
 * its hooks sign the user up or in, its session lives in the keychain (Clerk's `tokenCache`), and
 * every API call carries a fresh Clerk session token as the bearer. The server opened its own
 * session for that Clerk session at sign-in (`/auth/clerk/exchange`), so logout and sign-out
 * everywhere still end both.
 *
 * Set by `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (public, like the web's). Unset, the app keeps the
 * server's own password sign-in and token store (`secureTokens`).
 */
export const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

type Clerk = ReturnType<typeof getClerkInstance>;

let instance: Clerk | null = null;

/** The one Clerk instance; `ClerkProvider` is handed the same one, so hooks and this module agree. */
export function clerk(): Clerk {
  instance ??= getClerkInstance({ publishableKey: CLERK_PUBLISHABLE_KEY, tokenCache });
  return instance;
}

/** How long a cold start waits for Clerk before answering without it. */
const READY_TIMEOUT_MS = 15_000;

/** Resolves once Clerk has loaded, or failed to: either way its answer is as good as it gets. */
export function clerkReady(): Promise<Clerk> {
  const c = clerk();
  if (c.loaded) return Promise.resolve(c);
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      c.off('status', onStatus);
      resolve(c);
    };
    const onStatus = (status: string) => {
      if (status !== 'loading') done();
    };
    const timer = setTimeout(done, READY_TIMEOUT_MS);
    c.on('status', onStatus, { notify: true });
  });
}

/** Whether Clerk loaded and knows of no session: the only state that means "signed out". */
export async function clerkSignedOut(): Promise<boolean> {
  const c = await clerkReady();
  return c.status === 'ready' && !c.session;
}

const UNREACHABLE =
  'NextKin couldn’t reach its sign-in service. Check your connection and try again.';

/** A fresh Clerk session token (Clerk caches it and renews it before its 60 s are up). */
export async function clerkToken(options?: { skipCache?: boolean }): Promise<string | null> {
  const session = (await clerkReady()).session;
  if (!session) return null;
  try {
    return await session.getToken(options);
  } catch {
    // A session we can't mint a token for right now is an outage, never a sign-out.
    throw new ApiError('NETWORK', UNREACHABLE, 0);
  }
}

// The client only reads `accessToken`; the other two fields exist for the password store's shape.
const CLERK_REFRESH = 'clerk-session';
const CLERK_TOKEN_SECONDS = 60;

/**
 * The HTTP client's token store on Clerk. `exchange` opens (or reopens) the server session for the
 * current Clerk session; a 401 calls it once, which also covers a server session that expired
 * while Clerk's lived on. Signing out (`set(null)`) ends the Clerk session on the phone.
 */
export function clerkTokens(exchange: (token: string) => Promise<unknown>): TokenStore {
  return {
    async get() {
      const accessToken = await clerkToken();
      return accessToken
        ? { accessToken, refreshToken: CLERK_REFRESH, expiresIn: CLERK_TOKEN_SECONDS }
        : null;
    },
    async set(tokens) {
      if (tokens) return;
      await clerk()
        .signOut()
        .catch(() => {});
    },
    async refresh(): Promise<RefreshOutcome> {
      let token: string | null;
      try {
        token = await clerkToken({ skipCache: true });
      } catch {
        return 'unreachable';
      }
      if (!token) return 'refused';
      try {
        await exchange(token);
        return 'refreshed';
      } catch (error) {
        const status = (error as { status?: unknown }).status;
        if (typeof status !== 'number') return 'unreachable';
        return status === 0 || status >= 500 || status === 429 ? 'unreachable' : 'refused';
      }
    },
  };
}
