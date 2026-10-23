import { Suspense } from 'react';

import { JdPageScreen } from '@/features/jd/screens/JdPageScreen';
import { PageTransition } from '@/ui/PageTransition';

/** A job description's own page (toreview §110); `?edit=1` opens its §7.5 review. */
export default async function JobDescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageTransition>
      <Suspense>
        <JdPageScreen id={id} />
      </Suspense>
    </PageTransition>
  );
}
