import type { Metadata } from 'next';
import { ProvidersScreen } from '@/features/admin/business/screens/ProvidersScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Job providers · NextKin Admin' };

export default function AdminProvidersPage() {
  return (
    <PageTransition>
      <ProvidersScreen />
    </PageTransition>
  );
}
