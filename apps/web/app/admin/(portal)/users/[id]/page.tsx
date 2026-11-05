import type { Metadata } from 'next';
import { UserDetailScreen } from '@/features/admin/people/screens/UserDetailScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'User · NextKin Admin' };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageTransition>
      <UserDetailScreen id={id} />
    </PageTransition>
  );
}
