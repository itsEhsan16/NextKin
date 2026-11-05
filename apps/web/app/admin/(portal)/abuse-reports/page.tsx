import type { Metadata } from 'next';
import { AbuseReportsScreen } from '@/features/admin/trust/reports/AbuseReportsScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Abuse reports · NextKin Admin' };

export default function AdminAbuseReportsPage() {
  return (
    <PageTransition>
      <AbuseReportsScreen />
    </PageTransition>
  );
}
