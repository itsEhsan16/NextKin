import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ClerkAuthScreen } from '@/features/auth/screens/ClerkAuthScreen';
import { CLERK_ENABLED } from '@/lib/clerk';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Sign up · NextKin' };

/** Sign-up exists only through Clerk (toreview §169); without it there is no web sign-up yet. */
export default function SignUpPage() {
  if (!CLERK_ENABLED) notFound();
  return (
    <PageTransition>
      <ClerkAuthScreen mode="sign-up" />
    </PageTransition>
  );
}
