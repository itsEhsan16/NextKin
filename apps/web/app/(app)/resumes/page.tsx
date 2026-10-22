import { Suspense } from 'react';

import { ResumesRoute } from '@/features/resumes/screens/ResumesRoute';
import { ResumesScreen } from '@/features/resumes/screens/ResumesScreen';
import { PageTransition } from '@/ui/PageTransition';

/** `?resume=<id>` opens that resume on arrival; until the browser has it, the default selection. */
export default function ResumesPage() {
  return (
    <PageTransition>
      <Suspense fallback={<ResumesScreen />}>
        <ResumesRoute />
      </Suspense>
    </PageTransition>
  );
}
