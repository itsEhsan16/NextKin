import { Suspense } from 'react';

import { ZeroResumeRoute } from '@/features/create/screens/CreateRoutes';
import { ZeroResumeScreen } from '@/features/create/screens/ZeroResumeScreen';
import { PageTransition } from '@/ui/PageTransition';

/** Zero Resume — a first resume from three answers (toreview §125). */
export default function ZeroResumePage() {
  return (
    <PageTransition>
      <Suspense fallback={<ZeroResumeScreen />}>
        <ZeroResumeRoute />
      </Suspense>
    </PageTransition>
  );
}
