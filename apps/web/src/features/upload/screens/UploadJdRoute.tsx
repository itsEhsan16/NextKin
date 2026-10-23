'use client';

import { useSearchParams } from 'next/navigation';

import { UploadJdScreen } from './UploadJdScreen';

/**
 * `/upload-jd`. The old `?tab=file|link|paste` is ignored: there is one box now (toreview §114),
 * so links that carry it still land on the same page. `?for=build` is Home's Build Resume: the
 * same box, then a new resume built for the job (toreview §125).
 */
export function UploadJdRoute() {
  const params = useSearchParams();
  return <UploadJdScreen intent={params.get('for') === 'build' ? 'build' : 'tailor'} />;
}
