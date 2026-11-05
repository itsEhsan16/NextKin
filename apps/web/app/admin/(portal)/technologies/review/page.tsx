import type { Metadata } from 'next';
import { KbReviewScreen } from '@/features/admin/content/screens/KbReviewScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'KB review queue · NextKin Admin' };

export default function KbReviewPage() {
  return (
    <PageTransition>
      <KbReviewScreen />
    </PageTransition>
  );
}
