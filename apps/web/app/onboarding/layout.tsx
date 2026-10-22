import type { ReactNode } from 'react';

import { OnboardingFrame } from '@/features/onboarding/components/OnboardingFrame';
import { Toaster } from '@/ui/Toaster';

/** Web onboarding (ONB 01–04, `toreview.md` §106): outside the app shell, so no sidebar. */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <OnboardingFrame>{children}</OnboardingFrame>
      <Toaster />
    </>
  );
}
