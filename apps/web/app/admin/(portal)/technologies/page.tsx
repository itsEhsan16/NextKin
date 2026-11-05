import type { Metadata } from 'next';
import { TechnologiesScreen } from '@/features/admin/content/screens/TechnologiesScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Technology KB · NextKin Admin' };

export default function TechnologiesPage() {
  return (
    <PageTransition>
      <TechnologiesScreen />
    </PageTransition>
  );
}
