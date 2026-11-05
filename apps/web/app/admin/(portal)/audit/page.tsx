import type { Metadata } from 'next';
import { AuditLogScreen } from '@/features/admin/trust/audit/AuditLogScreen';
import { PageTransition } from '@/ui/PageTransition';

export const metadata: Metadata = { title: 'Audit log · NextKin Admin' };

export default function AdminAuditLogPage() {
  return (
    <PageTransition>
      <AuditLogScreen />
    </PageTransition>
  );
}
