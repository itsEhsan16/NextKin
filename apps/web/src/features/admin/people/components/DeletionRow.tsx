'use client';

import type { AdminDeletionRequest, AdminDeletionStatus } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { AdminBadge, type AdminBadgeTone } from '../../ui/AdminBadge';
import { adminButton } from '../../ui/adminButton';
import { adminTable } from '../../ui/AdminTable';
import { dueState, formatDate, formatShortDate, maskUser } from '../peopleFormat';
import { IdChip } from './PeopleBits';
import { RowMenu } from './RowMenu';
import { copyWithToast } from './StatsCaption';

const STATUS: Record<AdminDeletionStatus, { label: string; tone: AdminBadgeTone }> = {
  purging: { label: 'Purging', tone: 'info' },
  signed_out: { label: 'Signed out everywhere', tone: 'neutral' },
  scheduled: { label: 'Scheduled', tone: 'brand' },
  completed: { label: 'Completed', tone: 'success' },
};

/**
 * How long an open request has left (408:2843): red inside a week, amber otherwise. One past its
 * 30-day limit says it is overdue, never "Due today".
 */
function DaysLeft({ dueAt }: { dueAt: string }) {
  const { overdue, days } = dueState(dueAt);
  const span = `${days} day${days === 1 ? '' : 's'}`;
  const text = overdue ? `Overdue ${span}` : days <= 0 ? 'Due today' : span;
  return (
    <AdminBadge
      tone={overdue || days <= 7 ? 'danger' : 'warning'}
      icon={<AdminIcon name={overdue ? 'AlertTriangle' : 'Clock'} size="xs" />}
    >
      {text}
    </AdminBadge>
  );
}

/**
 * One deletion request (Figma 408:2843): the masked user and who asked, the dates, the time left,
 * its status, and "Process now" for one still waiting, when the role may manage users.
 */
export function DeletionRow({
  request,
  canProcess,
  onProcess,
}: {
  request: AdminDeletionRequest;
  /** The role has `users.manage`, which the server needs to purge. */
  canProcess: boolean;
  onProcess: () => void;
}) {
  const status = STATUS[request.status];
  const waiting = request.status === 'signed_out' || request.status === 'scheduled';
  const who = maskUser(request.userId);
  return (
    <tr className={adminTable.row}>
      <td className={adminTable.td}>
        <div className="flex flex-col items-start gap-1">
          <IdChip>{who}</IdChip>
          <span>{request.origin === 'user' ? 'Requested by user' : 'Admin-initiated'}</span>
        </div>
      </td>
      <td className={adminTable.td}>{formatDate(request.requestedAt)}</td>
      <td className={adminTable.td}>{formatDate(request.dueAt)}</td>
      <td className={adminTable.td}>
        {request.completedAt ? (
          `Done ${formatShortDate(request.completedAt)}`
        ) : (
          <DaysLeft dueAt={request.dueAt} />
        )}
      </td>
      <td className={adminTable.td}>
        <AdminBadge tone={status.tone} dot>
          {status.label}
        </AdminBadge>
      </td>
      <td className={cn(adminTable.td, 'text-right')}>
        {waiting && canProcess ? (
          <button
            type="button"
            onClick={onProcess}
            aria-label={`Process now for ${who}`}
            className={adminButton.small}
          >
            Process now
          </button>
        ) : (
          <span className="inline-flex justify-end">
            <RowMenu
              label={who}
              actions={[
                {
                  label: 'Copy request ID',
                  onSelect: () => copyWithToast(request.id, 'Request ID copied'),
                },
              ]}
            />
          </span>
        )}
      </td>
    </tr>
  );
}
