import type { Metadata } from 'next';
import { FailuresScreen } from '@/features/admin/trust/failures/FailuresScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Generation failures · NextKin Admin' };

export default function AdminFailuresPage() {
  return (
    <PageTransition>
      <FailuresScreen />
    </PageTransition>
  );
}
