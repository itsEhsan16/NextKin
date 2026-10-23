import { Suspense } from 'react';

import { TailorRoute } from '@/features/tailor/screens/TailorRoute';
import { TailorScreen } from '@/features/tailor/screens/TailorScreen';
import { PageTransition } from '@/ui/PageTransition';

/** Tailor a resume to a job description the user brought (734:2 → 734:2033, toreview §110). */
export default async function JdTailorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = { kind: 'jd' as const, id };
  return (
    <PageTransition>
      <Suspense fallback={<TailorScreen target={target} />}>
        <TailorRoute target={target} />
      </Suspense>
    </PageTransition>
  );
}
