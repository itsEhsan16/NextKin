import type { Metadata } from 'next';
import { StaffScreen } from '@/features/admin/people/screens/StaffScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Staff & roles · NextKin Admin' };

export default function AdminStaffPage() {
  return (
    <PageTransition>
      <StaffScreen />
    </PageTransition>
  );
}
