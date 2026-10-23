import type { Metadata } from 'next';

import { SignInScreen } from '@/features/auth/screens/SignInScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Sign in · NextKin' };

export default function SignInPage() {
  return (
    <PageTransition>
      <SignInScreen />
    </PageTransition>
  );
}
