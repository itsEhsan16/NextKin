'use client';

import { REPORT_CATEGORY_LABEL, type AbuseReport, type ReportAction } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';

import { AdminBadge } from '../../ui/AdminBadge';
import { adminTable } from '../../ui/AdminTable';
import { RowMenu } from '../RowMenu';
import { formatReceived } from '../trustFormat';
import { STATUS, itemKind, itemRef } from './reportLabels';

const th = cn(adminTable.th, 'px-2 first:pl-6 last:pr-4');
const td = cn(adminTable.td, 'px-2 first:pl-6 last:pr-4');

/**
 * Reports, one per row (Figma 407:1165): the report, its category, the item it points at, the
 * reporter (always Anonymous), when it arrived and its status. A row puts its report in the card
 * beside the table; the ⋮ settles it from here.
 */
export function ReportsTable({
  rows,
  focused,
  onFocus,
  onAct,
}: {
  rows: AbuseReport[];
  focused: string | null;
  onFocus: (id: string) => void;
  onAct: (id: string, action: ReportAction) => void;
}) {
  return (
    <table className={cn(adminTable.table, 'min-w-[860px]')}>
      <thead className={adminTable.head}>
        <tr>
          <th scope="col" className={cn(th, 'w-[132px]')}>
            Report
          </th>
          <th scope="col" className={cn(th, 'w-[146px]')}>
            Category
          </th>
          <th scope="col" className={cn(th, 'w-[206px]')}>
            Reported item
          </th>
          <th scope="col" className={cn(th, 'w-[126px]')}>
            Reporter
          </th>
          <th scope="col" className={cn(th, 'w-[146px]')}>
            Received
          </th>
          <th scope="col" className={th}>
            Status
          </th>
          <th scope="col" className={cn(th, 'w-[44px]')}>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const status = STATUS[row.status];
          const open = row.status === 'open';
          return (
            <tr
              key={row.id}
              onClick={() => onFocus(row.id)}
              aria-selected={focused === row.id}
              className={cn(
                adminTable.row,
                'cursor-pointer',
                focused === row.id && 'bg-brand-50 hover:bg-brand-50',
              )}
            >
              <td className={cn(td, 'text-text-primary')}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onFocus(row.id);
                  }}
                  aria-label={`Open ${row.id}`}
                  className="rounded-tag hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  {row.id}
                </button>
              </td>
              <td className={cn(td, 'text-neutral-700')}>{REPORT_CATEGORY_LABEL[row.category]}</td>
              <td className={td}>
                <span className="flex flex-col items-start gap-0.5">
                  <AdminBadge tone="neutral">{itemRef(row.item)}</AdminBadge>
                  <span className="text-caption-m font-normal text-text-tertiary">
                    {itemKind(row.item)}
                  </span>
                </span>
              </td>
              <td className={td}>Anonymous</td>
              <td className={td}>
                <time dateTime={row.receivedAt}>{formatReceived(row.receivedAt)}</time>
              </td>
              <td className={td}>
                <AdminBadge tone={status.tone} dot>
                  {status.label}
                </AdminBadge>
              </td>
              <td className={td} onClick={(event) => event.stopPropagation()}>
                <RowMenu
                  label={row.id}
                  items={[
                    { label: 'View report', onSelect: () => onFocus(row.id) },
                    { label: 'Dismiss', onSelect: () => onAct(row.id, 'dismiss'), disabled: !open },
                    {
                      label: 'Disable public link',
                      onSelect: () => onAct(row.id, 'disable_link'),
                      disabled: !open,
                    },
                    {
                      label: 'Suspend user…',
                      onSelect: () => onAct(row.id, 'suspend_owner'),
                      tone: 'danger',
                      disabled: !open,
                    },
                  ]}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
