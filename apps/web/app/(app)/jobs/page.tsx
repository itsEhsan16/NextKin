import { Suspense } from 'react';

import { JobsRoute } from '@/features/jobs/screens/JobsRoute';
import { JobsScreen } from '@/features/jobs/screens/JobsScreen';
import { PageTransition } from '@/ui/PageTransition';

/**
 * `?job=<id>` opens that job on arrival (`src/features/jobs/jobHref.ts`). The parameter is read in the browser (`JobsRoute`), so this route is
 * static and prefetched; until the browser has it (a hard load only), the screen shows its
 * default selection.
 */
export default function JobsPage() {
  return (
    <PageTransition>
      <Suspense fallback={<JobsScreen />}>
        <JobsRoute />
      </Suspense>
    </PageTransition>
  );
}
