import { Suspense } from 'react';

import { AtsCheckRoute } from '@/features/create/screens/CreateRoutes';
import { AtsCheckScreen } from '@/features/create/screens/AtsCheckScreen';
import { PageTransition } from '@/ui/PageTransition';

/** Check a resume against one job (toreview §125). */
export default function AtsCheckPage() {
  return (
    <PageTransition>
      <Suspense fallback={<AtsCheckScreen />}>
        <AtsCheckRoute />
      </Suspense>
    </PageTransition>
  );
}
