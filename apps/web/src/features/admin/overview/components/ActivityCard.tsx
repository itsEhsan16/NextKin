'use client';

import type { Route } from 'next';
import { useDeferredValue, useState } from 'react';

import {
  ADMIN_ROLE_LABEL,
  type AdminActivity,
  type AdminActivityResult,
  type AdminRole,
} from '@nextkin/shared/models';
import { useAdminActivity } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';
import { Skeleton } from '@/ui/Skeleton';
import { Soon } from '@/ui/Soon';
import { StateView } from '@/ui/StateView';

import { activityRows, downloadCsv } from '../../exportCsv';
import { initialsOf, maskTarget } from '../../format';
import { adminButton, adminSoon } from '../../ui/adminButton';
import { AdminBadge, type AdminBadgeTone } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty } from '../../ui/AdminCard';
import { CardMenu } from '../../ui/CardMenu';

const RESULT: Record<AdminActivityResult, { label: string; tone: AdminBadgeTone }> = {
  done: { label: 'Done', tone: 'success' },
  audited_read: { label: 'Audited read', tone: 'warning' },
  suspended: { label: 'Suspended', tone: 'danger' },
  failed: { label: 'Failed', tone: 'danger' },
};

/** Each role's avatar tint in the audit rows (Figma 396:767, 396:790, 396:813). */
const ROLE_TINT: Record<AdminRole, string> = {
  support: 'bg-info-50 text-info-600',
  curator: 'bg-warning-50 text-warning-600',
  admin: 'bg-brand-100 text-brand-700',
  super_admin: 'bg-brand-100 text-brand-700',
};

const AUDIT = [{ label: 'Open Audit log', href: '/admin/audit' as Route }];
/**
 * The board's columns (396:751): fixed content widths with a 16px gap between them, 24px in from
 * the left and 16px from the right, and Action taking what is left. Each cell's width here is its
 * content plus the gap before it.
 */
const edge = 'pl-4 first:pl-6 last:pr-4';
const head = cn('py-3 text-left text-caption-m font-medium text-text-secondary', edge);
const cell = cn('py-4 align-middle', edge);
const COLUMN = {
  staff: 'w-[284px]',
  target: 'w-[196px]',
  reason: 'w-[316px]',
  result: 'w-[166px]',
  time: 'w-[126px]',
  more: 'w-[72px]',
};

/** A time of day in UTC, 24-hour: the Audit log prints UTC, so the same event reads the same. */
const clockUtc = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });

/**
 * The newest staff actions (Figma 396:745): who did what to which masked target, why, and how it
 * ended. The search narrows the rows by action, staff, reason or target; the full log, its filters
 * and its export are the Audit log page's.
 */
export function ActivityCard({ enabled = true }: { enabled?: boolean }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const activity = useAdminActivity(deferred, { enabled });

  return (
    <AdminCard
      icon="ClipboardCheck"
      title="Recent admin activity"
      trailing={
        <div className="flex items-center gap-3">
          <label className="flex h-control-md w-[300px] items-center gap-2 rounded-sm border border-neutral-300 bg-surface-card px-3 shadow-xs transition-field duration-fast ease-standard focus-within:border-border-selected focus-within:ring-4 focus-within:ring-brand-100">
            <AdminIcon name="SearchLg" className="text-neutral-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search actions, staff, IDs"
              aria-label="Search recent admin activity"
              className="min-w-0 flex-1 bg-transparent text-body-m text-text-primary outline-none placeholder:text-text-tertiary"
            />
          </label>
          <Soon label="Filters are on the Audit log page, coming soon">
            <button type="button" aria-disabled="true" className={cn(adminButton.small, adminSoon)}>
              <AdminIcon name="FilterLines" />
              Filters
            </button>
          </Soon>
          {/* The rows on screen, as the table shows them; the full log's export is the Audit log's. */}
          <button
            type="button"
            disabled={!activity.data?.length}
            onClick={() =>
              activity.data &&
              downloadCsv('nextkin-admin-activity.csv', activityRows(activity.data))
            }
            className={adminButton.small}
          >
            <AdminIcon name="Download01" />
            Export
          </button>
        </div>
      }
      bodyClassName="p-0 overflow-x-auto"
    >
      {activity.isPending ? (
        <div aria-hidden className="flex flex-col gap-4 p-6">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : activity.isError ? (
        <StateView
          tone="danger"
          title="Couldn’t load recent activity"
          actionLabel="Try again"
          onAction={() => void activity.refetch()}
        />
      ) : activity.data.length === 0 ? (
        <CardEmpty
          title={deferred ? 'No matching activity' : 'No staff activity yet'}
          message={
            deferred ? 'Try another action, name or ID.' : 'Staff actions show here as they happen.'
          }
        />
      ) : (
        <table className="w-full min-w-[1400px] table-fixed border-collapse">
          <thead className="border-b border-neutral-200 bg-neutral-50">
            <tr>
              <th scope="col" className={cn(head, COLUMN.staff)}>
                Staff
              </th>
              <th scope="col" className={head}>
                Action
              </th>
              <th scope="col" className={cn(head, COLUMN.target)}>
                Target
              </th>
              <th scope="col" className={cn(head, COLUMN.reason)}>
                Reason
              </th>
              <th scope="col" className={cn(head, COLUMN.result)}>
                Result
              </th>
              <th scope="col" className={cn(head, COLUMN.time)}>
                Time <span className="sr-only">(UTC)</span>
              </th>
              <th scope="col" className={cn(head, COLUMN.more)}>
                <span className="sr-only">More</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {activity.data.map((row) => (
              <Row key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      )}
    </AdminCard>
  );
}

function Row({ row }: { row: AdminActivity }) {
  const result = RESULT[row.result];
  return (
    <tr className="animate-rise border-b border-neutral-100 transition-colors duration-press ease-standard last:border-b-0 hover:bg-neutral-50">
      <td className={cell}>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-900/10 text-caption-m font-semibold',
              ROLE_TINT[row.staff.role],
            )}
          >
            {initialsOf(row.staff.name)}
          </span>
          <div className="flex min-w-0 flex-col text-body-s">
            <span className="truncate font-semibold text-text-primary">{row.staff.name}</span>
            <span className="truncate text-text-secondary">{ADMIN_ROLE_LABEL[row.staff.role]}</span>
          </div>
        </div>
      </td>
      <td className={cn(cell, 'truncate text-body-s font-medium text-text-primary')}>
        {row.action}
      </td>
      <td className={cell}>
        <AdminBadge tone="neutral">{maskTarget(row.target)}</AdminBadge>
      </td>
      <td className={cn(cell, 'truncate text-body-s text-text-secondary')}>{row.reason}</td>
      <td className={cell}>
        <AdminBadge tone={result.tone} dot>
          {result.label}
        </AdminBadge>
      </td>
      <td className={cn(cell, 'text-body-s tabular-nums text-text-secondary')}>
        <time dateTime={row.at} title="UTC">
          {clockUtc(row.at)}
        </time>
      </td>
      <td className={cell}>
        <CardMenu label={row.action} items={AUDIT} size="md" />
      </td>
    </tr>
  );
}
