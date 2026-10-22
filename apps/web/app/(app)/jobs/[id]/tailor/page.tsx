import { Suspense } from 'react';

import { TailorRoute } from '@/features/tailor/screens/TailorRoute';
import { TailorScreen } from '@/features/tailor/screens/TailorScreen';
import { PageTransition } from '@/ui/PageTransition';

/** Tailor a resume to this job (734:2 → 734:2033, `toreview.md` §103, §110). */
export default async function TailorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = { kind: 'job' as const, id };
  return (
    <PageTransition>
      <Suspense fallback={<TailorScreen target={target} />}>
        <TailorRoute target={target} />
      </Suspense>
    </PageTransition>
  );
}
