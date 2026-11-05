'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';

import type { AdminUserRow, AdminUsersFilter, AdminUsersPage } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';
import { Skeleton } from '@/ui/Skeleton';
import { Soon } from '@/ui/Soon';
import { StateView } from '@/ui/StateView';

import { formatCount } from '../../format';
import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { adminButton, adminSoon } from '../../ui/adminButton';
import { AdminCheckbox, adminTable, Pager, SortHeader, TableToolbar } from '../../ui/AdminTable';
import { ButtonGroup } from '../../ui/ButtonGroup';
import { SearchField } from '../../ui/SearchField';
import { PasswordResetDialog } from '../dialogs/AccountDialogs';
import { ReactivateDialog, SuspendDialog } from '../dialogs/SuspendDialogs';
import { UserRow, type UserRowDialog } from './UserRow';

const th = cn(adminTable.th, 'px-2 first:pl-6');

type Dialog = { kind: UserRowDialog; user: AdminUserRow } | null;

export type UsersTableCardProps = {
  total: number | null;
  counts: { suspended: number; deletion_pending: number } | null;
  query: UseQueryResult<AdminUsersPage>;
  filter: AdminUsersFilter;
  onFilter: (filter: AdminUsersFilter) => void;
  search: string;
  onSearch: (search: string) => void;
  sort: 'asc' | 'desc' | null;
  onSort: () => void;
  onPage: (page: number) => void;
  selected: ReadonlySet<string>;
  onSelect: (selected: ReadonlySet<string>) => void;
};

/**
 * The "All users" card (Figma 404:831): the plan and state tabs with their counts, the search,
 * the table, and the pager. A row's name opens the user; its ⋮ suspends, reactivates or sends a
 * password reset, each through its dialog.
 */
export function UsersTableCard(props: UsersTableCardProps) {
  const {
    total,
    counts,
    query,
    filter,
    onFilter,
    search,
    onSearch,
    sort,
    onSort,
    onPage,
    selected,
    onSelect,
  } = props;
  const [dialog, setDialog] = useState<Dialog>(null);
  const data = query.data;
  const rows = data?.rows ?? [];
  const allOn = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const someOn = rows.some((row) => selected.has(row.id));

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onSelect(next);
  };

  return (
    <AdminCard
      icon="Users01"
      title="All users"
      trailing={total !== null && <AdminBadge tone="neutral">{formatCount(total)}</AdminBadge>}
      bodyClassName="p-0"
    >
      <TableToolbar>
        <ButtonGroup
          label="Show"
          size="md"
          value={filter}
          onChange={onFilter}
          options={[
            { id: 'all', label: 'All' },
            { id: 'free', label: 'Free' },
            { id: 'pro', label: 'Pro' },
            { id: 'suspended', label: 'Suspended', ...(counts ? { count: counts.suspended } : {}) },
            {
              id: 'deletion_pending',
              label: 'Deletion pending',
              ...(counts ? { count: counts.deletion_pending } : {}),
            },
          ]}
        />
        <span className="flex-1" />
        <SearchField value={search} onChange={onSearch} placeholder="Email, name or user ID" />
        <Soon label="More filters are coming soon">
          <button
            type="button"
            aria-disabled="true"
            className={cn(adminButton.secondary, adminSoon)}
          >
            <AdminIcon name="FilterLines" />
            Filters
          </button>
        </Soon>
      </TableToolbar>

      {query.isPending ? (
        <div aria-hidden className="flex flex-col gap-3 p-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <StateView
          tone="danger"
          title="Couldn’t load users"
          actionLabel="Try again"
          onAction={() => void query.refetch()}
        />
      ) : data && !data.served ? (
        data.unserved === 'filter' ? (
          <NotConnected what="the plan on each account, so Free and Pro can’t be listed" />
        ) : (
          <CardEmpty
            title="Search to find a user"
            message="Type at least two characters of an email, a name or a user ID."
          />
        )
      ) : rows.length === 0 ? (
        <CardEmpty
          title={search || filter !== 'all' ? 'No users match' : 'No users yet'}
          message={
            search || filter !== 'all'
              ? 'Try another name, email or tab.'
              : 'Accounts show here as people sign up.'
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className={cn(adminTable.table, 'min-w-[1100px]')}>
            <thead className={adminTable.head}>
              <tr>
                <th scope="col" className={cn(th, 'w-12')}>
                  <AdminCheckbox
                    checked={allOn}
                    indeterminate={someOn && !allOn}
                    onChange={(on) => onSelect(on ? new Set(rows.map((row) => row.id)) : new Set())}
                    label="Select every user on this page"
                  />
                </th>
                <th scope="col" className={th}>
                  User
                </th>
                <th scope="col" className={cn(th, 'w-[126px]')}>
                  Plan
                </th>
                <th scope="col" className={cn(th, 'w-[186px]')}>
                  Status
                </th>
                <th scope="col" className={cn(th, 'w-[216px]')}>
                  Usage this month
                </th>
                <th
                  scope="col"
                  className={cn(th, 'w-[146px]')}
                  aria-sort={sort === null ? 'none' : sort === 'asc' ? 'ascending' : 'descending'}
                >
                  <SortHeader label="Signed up" direction={sort} onToggle={onSort} />
                </th>
                <th scope="col" className={cn(th, 'w-[136px]')}>
                  Last active
                </th>
                <th scope="col" className={cn(th, 'w-24')}>
                  Resumes
                </th>
                {/* 8 + the 24px ⋮ + 16 (404:881/404:911). */}
                <th scope="col" className={cn(th, 'w-12')}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <UserRow
                  key={row.id}
                  row={row}
                  index={index}
                  selected={selected.has(row.id)}
                  onToggle={(next) => toggle(row.id, next)}
                  onDialog={(kind) => setDialog({ kind, user: row })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.served && rows.length > 0 && (
        <Pager page={data.page} pages={data.pages} onPage={onPage} />
      )}

      {dialog && (
        <>
          <SuspendDialog
            user={dialog.user}
            open={dialog.kind === 'suspend'}
            onOpenChange={(open) => !open && setDialog(null)}
          />
          <ReactivateDialog
            user={dialog.user}
            open={dialog.kind === 'reactivate'}
            onOpenChange={(open) => !open && setDialog(null)}
          />
          <PasswordResetDialog
            user={dialog.user}
            open={dialog.kind === 'reset'}
            onOpenChange={(open) => !open && setDialog(null)}
          />
        </>
      )}
    </AdminCard>
  );
}
