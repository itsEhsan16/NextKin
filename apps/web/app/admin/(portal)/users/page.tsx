import type { Metadata } from 'next';
import { UsersScreen } from '@/features/admin/people/screens/UsersScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Users · NextKin Admin' };

export default function AdminUsersPage() {
  return (
    <PageTransition>
      <UsersScreen />
    </PageTransition>
  );
}
