import type { Metadata } from 'next';

import { ClerkAuthScreen } from '@/features/auth/screens/ClerkAuthScreen';
import { SignInScreen } from '@/features/auth/screens/SignInScreen';
import { CLERK_ENABLED } from '@/lib/clerk';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Sign in · NextKin' };

/** Optional catch-all: Clerk's sign-in steps (factor two, SSO callback) live under /sign-in/*. */
export default function SignInPage() {
  return (
    <PageTransition>
      {CLERK_ENABLED ? <ClerkAuthScreen mode="sign-in" /> : <SignInScreen />}
    </PageTransition>
  );
}
