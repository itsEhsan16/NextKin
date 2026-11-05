import type { Metadata } from 'next';
import { PlansScreen } from '@/features/admin/business/screens/PlansScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Plans & pricing · NextKin Admin' };

export default function AdminPlansPage() {
  return (
    <PageTransition>
      <PlansScreen />
    </PageTransition>
  );
}
