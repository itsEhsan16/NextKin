import { Suspense } from 'react';

import { ApplicationsRoute } from '@/features/applications/screens/ApplicationsRoute';
import { ApplicationsScreen } from '@/features/applications/screens/ApplicationsScreen';
import { PageTransition } from '@/ui/PageTransition';

/** `?application=<id>` opens that application on arrival; until the browser has it, the default selection. */
export default function ApplicationsPage() {
  return (
    <PageTransition>
      <Suspense fallback={<ApplicationsScreen />}>
        <ApplicationsRoute />
      </Suspense>
    </PageTransition>
  );
}
