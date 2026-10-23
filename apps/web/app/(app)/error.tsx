'use client';

import { PageErrorScreen } from '@/features/system/SystemScreens';
import { PageTransition } from '@/ui/PageTransition';

/** A page that threw while rendering: the shell stays, and the page can be tried again (§85). */
export default function PageError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageTransition>
      <PageErrorScreen onRetry={reset} />
    </PageTransition>
  );
}
