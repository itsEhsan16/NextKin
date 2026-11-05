import type { FailureStatus } from '@nextkin/shared/models';

import { AdminBadge, type AdminBadgeTone } from '../../ui/AdminBadge';

const STATUS: Record<FailureStatus, { label: string; tone: AdminBadgeTone }> = {
  open: { label: 'Open', tone: 'danger' },
  retrying: { label: 'Retrying', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
};

/** "● Open" red, "● Retrying" amber, "● Resolved" green (Figma 406:1468, 406:1522, 406:1652). */
export function FailureStatusBadge({ status }: { status: FailureStatus }) {
  const { label, tone } = STATUS[status];
  return (
    <AdminBadge tone={tone} dot>
      {label}
    </AdminBadge>
  );
}
