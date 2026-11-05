import type { Metadata } from 'next';
import { AdminOverviewScreen } from '@/features/admin/screens/AdminOverviewScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Overview · NextKin Admin' };

export default function AdminOverviewPage() {
  return (
    <PageTransition>
      <AdminOverviewScreen />
    </PageTransition>
  );
}
