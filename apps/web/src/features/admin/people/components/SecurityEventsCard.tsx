'use client';

import type { ReactNode } from 'react';

import type { AdminSecurityEvent } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';

import { AdminBadge, type AdminBadgeTone } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty } from '../../ui/AdminCard';
import { adminTable } from '../../ui/AdminTable';
import { formatEventTime } from '../peopleFormat';

const RESULT: Record<AdminSecurityEvent['result'], { label: string; tone: AdminBadgeTone }> = {
  success: { label: 'Success', tone: 'success' },
  admin: { label: 'Admin', tone: 'brand' },
  failed: { label: 'Failed', tone: 'danger' },
};

/** Security events (Figma 406:2525): the newest five, or every one on its own tab. */
export function SecurityEventsCard({
  events,
  limit,
  onViewAll,
}: {
  events: AdminSecurityEvent[];
  limit?: number;
  onViewAll?: () => void;
}) {
  const shown = limit ? events.slice(0, limit) : events;
  return (
    <AdminCard
      icon="ShieldTick"
      title="Security events"
      trailing={onViewAll && <ViewAll onClick={onViewAll} />}
      bodyClassName="overflow-x-auto p-0"
    >
      {shown.length === 0 ? (
        <CardEmpty
          title="No security events"
          message="Sign-ins, resets and failed attempts show here."
        />
      ) : (
        <table className={cn(adminTable.table, 'min-w-[900px]')}>
          <thead className={adminTable.head}>
            <tr>
              <Th className="">Event</Th>
              <Th className="w-[146px]">Result</Th>
              <Th className="w-[166px]">IP address</Th>
              <Th className="w-[236px]">Device</Th>
              <Th className="w-[166px]">When</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((event) => (
              <tr key={event.id} className={adminTable.row}>
                <td className={cn(adminTable.td, 'font-semibold text-text-primary')}>
                  {event.event}
                </td>
                <td className={adminTable.td}>
                  <AdminBadge tone={RESULT[event.result].tone} dot>
                    {RESULT[event.result].label}
                  </AdminBadge>
                </td>
                <td className={adminTable.td}>{event.ip ?? '—'}</td>
                <td className={adminTable.td}>{event.device}</td>
                <td className={adminTable.td}>{formatEventTime(event.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminCard>
  );
}

function Th({ className, children }: { className: string; children: ReactNode }) {
  return (
    <th scope="col" className={cn(adminTable.th, className)}>
      {children}
    </th>
  );
}

/** "View all →" in a card header (Figma 406:2525). */
export function ViewAll({ onClick, label = 'View all' }: { onClick: () => void; label?: string }) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <button
      type="button"
      onClick={onClick}
      {...hoverProps}
      className="relative flex h-9 items-center gap-1.5 rounded-sm text-body-s font-semibold text-brand-700 after:absolute after:-inset-x-1 after:inset-y-0 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600"
    >
      {label}
      <AdminIcon ref={iconRef} name="ArrowRight" />
    </button>
  );
}
