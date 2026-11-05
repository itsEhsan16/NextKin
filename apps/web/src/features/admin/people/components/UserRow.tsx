'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { AdminUserRow } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';

import { AdminCheckbox, adminTable } from '../../ui/AdminTable';
import { AVATAR_TINTS, formatAgo, formatDate } from '../peopleFormat';
import { PersonAvatar, PlanBadge, UsageBar, UserStatusBadge } from './PeopleBits';
import { RowMenu } from './RowMenu';

/** The Users table's cell: 8px each side, 24 in on the first column (404:862). */
export const usersTd = cn(adminTable.td, 'px-2 first:pl-6');

export type UserRowDialog = 'suspend' | 'reactivate' | 'reset';

/**
 * One account in the "All users" table (Figma 404:882): select, the person (opening the user),
 * plan, status, this month's generations, sign-up, last active, resumes, and the ⋮ menu.
 */
export function UserRow({
  row,
  index,
  selected,
  onToggle,
  onDialog,
}: {
  row: AdminUserRow;
  /** The row's place on the page, which picks the avatar tint as the board cycles them. */
  index: number;
  selected: boolean;
  onToggle: (selected: boolean) => void;
  onDialog: (kind: UserRowDialog) => void;
}) {
  const router = useRouter();
  const td = usersTd;
  return (
    <tr className={cn(adminTable.row, selected && adminTable.rowSelected)}>
      <td className={td}>
        <AdminCheckbox checked={selected} onChange={onToggle} label={`Select ${row.name}`} />
      </td>
      <td className={td}>
        <Link
          href={`/admin/users/${row.id}` as Route}
          className="flex w-fit items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <PersonAvatar name={row.name} tint={AVATAR_TINTS[index % AVATAR_TINTS.length]!} />
          <span className="flex min-w-0 flex-col">
            <span className={cn(adminTable.primary, 'hover:text-brand-700')}>{row.name}</span>
            <span className={adminTable.secondary}>{row.email}</span>
          </span>
        </Link>
      </td>
      <td className={td}>
        <PlanBadge plan={row.plan} />
      </td>
      <td className={td}>
        <UserStatusBadge status={row.status} />
      </td>
      <td className={td}>
        {row.usage ? (
          <div className="flex w-[180px] flex-col gap-1.5">
            <UsageBar
              used={row.usage.used}
              limit={row.usage.limit}
              label={`${row.name}'s generations this month`}
            />
            <span className="text-caption-m font-normal text-text-secondary">
              {row.usage.used} of {row.usage.limit} generations
            </span>
          </div>
        ) : (
          '—'
        )}
      </td>
      <td className={td}>{formatDate(row.signedUpAt, true)}</td>
      <td className={td}>{row.lastActiveAt ? formatAgo(row.lastActiveAt, 'days') : '—'}</td>
      <td className={td}>{row.resumes ?? '—'}</td>
      <td className={td}>
        <RowMenu
          label={row.name}
          actions={[
            {
              label: 'Open user',
              onSelect: () => router.push(`/admin/users/${row.id}` as Route),
            },
            { label: 'Send password reset', onSelect: () => onDialog('reset') },
            row.status === 'suspended'
              ? { label: 'Reactivate', onSelect: () => onDialog('reactivate') }
              : { label: 'Suspend', tone: 'danger', onSelect: () => onDialog('suspend') },
          ]}
        />
      </td>
    </tr>
  );
}
