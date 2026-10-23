import { Suspense } from 'react';

import { CoverLetterRoute } from '@/features/create/screens/CreateRoutes';
import { CoverLetterScreen } from '@/features/create/screens/CoverLetterScreen';
import { PageTransition } from '@/ui/PageTransition';

/** Write a cover letter from a tailored resume (toreview §125). */
export default function CoverLetterPage() {
  return (
    <PageTransition>
      <Suspense fallback={<CoverLetterScreen />}>
        <CoverLetterRoute />
      </Suspense>
    </PageTransition>
  );
}
