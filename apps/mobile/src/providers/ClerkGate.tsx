import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import type { ReactNode } from 'react';

import { CLERK_PUBLISHABLE_KEY } from '@/data/clerkSession';
import { USES_CLERK } from '@/data/dataSource';

/**
 * Clerk's provider, only when the app signs in through Clerk (toreview §173). It is given the same
 * key and token cache as `clerkSession.clerk()`, so it reuses that one instance: the hooks on the
 * sign-in screens and the HTTP client's token store see the same session. Without Clerk, nothing
 * is mounted and the app is exactly as before.
 */
export function ClerkGate({ children }: { children: ReactNode }) {
  if (!USES_CLERK) return <>{children}</>;
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      {children}
    </ClerkProvider>
  );
}
