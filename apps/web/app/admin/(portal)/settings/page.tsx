import type { Metadata } from 'next';
import { AdminSettingsScreen } from '@/features/admin/trust/settings/AdminSettingsScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Settings · NextKin Admin' };

export default function AdminSettingsPage() {
  return (
    <PageTransition>
      <AdminSettingsScreen />
    </PageTransition>
  );
}
