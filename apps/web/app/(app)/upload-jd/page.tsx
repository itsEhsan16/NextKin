import { Suspense } from 'react';

import { UploadJdRoute } from '@/features/upload/screens/UploadJdRoute';
import { UploadJdScreen } from '@/features/upload/screens/UploadJdScreen';
import { PageTransition } from '@/ui/PageTransition';

/**
 * `?tab=file|link|paste` opens that way in on arrival, e.g. `/upload-jd?tab=file`. The parameter is read in the browser (`UploadJdRoute`), so this route is
 * static and prefetched; until the browser has it (a hard load only), the screen shows its
 * default tab.
 */
export default function UploadJdPage() {
  return (
    <PageTransition>
      <Suspense fallback={<UploadJdScreen />}>
        <UploadJdRoute />
      </Suspense>
    </PageTransition>
  );
}
