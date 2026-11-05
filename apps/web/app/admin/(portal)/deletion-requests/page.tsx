import type { Metadata } from 'next';
import { DeletionRequestsScreen } from '@/features/admin/people/screens/DeletionRequestsScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Deletion requests · NextKin Admin' };

export default function AdminDeletionRequestsPage() {
  return (
    <PageTransition>
      <DeletionRequestsScreen />
    </PageTransition>
  );
}
