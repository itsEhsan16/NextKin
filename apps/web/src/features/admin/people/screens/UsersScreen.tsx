'use client';

import { useDeferredValue, useState } from 'react';

import type { AdminUsersFilter, AdminUserStats } from '@nextkin/shared/models';
import { useAdminUsers, useAdminUserStats } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';

import { downloadCsv } from '../../exportCsv';
import { formatCount } from '../../format';
import { DeltaBadge, TrendBadge } from '../../ui/AdminBadge';
import { AdminPage } from '../../ui/AdminPage';
import { adminButton } from '../../ui/adminButton';
import { StatCard } from '../../ui/StatCard';
import { formatDate } from '../peopleFormat';
import { RetryCaption } from '../components/StatsCaption';
import { UsersTableCard } from '../components/UsersTable';

/**
 * Users (Figma 404:614): the platform's totals, then every account, searchable by email, name or
 * id, filtered by plan or state and sorted by sign-up date. Every change a staff member makes from
 * here is audited on the server.
 */
export function UsersScreen() {
  const stats = useAdminUserStats();
  const [filter, setFilter] = useState<AdminUsersFilter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'asc' | 'desc' | null>(null);
  const [page, setPage] = useState(1);
  const q = useDeferredValue(search);
  const users = useAdminUsers({ filter, q, sort, page });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // The selection is the rows on screen: a new search, tab or page starts it again, so "Export N
  // selected" always exports the N rows it names.
  const clearSelection = () => setSelected(new Set());

  const exportRows = () => {
    const rows = (users.data?.rows ?? []).filter(
      (row) => selected.size === 0 || selected.has(row.id),
    );
    downloadCsv('nextkin-users.csv', [
      ['id', 'name', 'email', 'plan', 'status', 'signed up', 'resumes'],
      ...rows.map((row) => [
        row.id,
        row.name,
        row.email,
        row.plan ?? '',
        row.status,
        formatDate(row.signedUpAt),
        row.resumes ?? '',
      ]),
    ]);
  };

  return (
    <AdminPage
      title="Users"
      subtitle="Search by email, name or user ID. Every change you make is audited."
      actions={
        <ExportButton
          count={selected.size}
          disabled={!users.data?.rows.length}
          onExport={exportRows}
        />
      }
    >
      <Stats
        stats={stats.isPending || stats.isError ? undefined : stats.data}
        failed={stats.isError}
        onRetry={() => void stats.refetch()}
      />
      <UsersTableCard
        total={stats.data?.total ?? null}
        counts={
          stats.data
            ? { suspended: stats.data.suspended, deletion_pending: stats.data.pendingDeletion }
            : null
        }
        query={users}
        filter={filter}
        onFilter={(next) => {
          setFilter(next);
          setPage(1);
          clearSelection();
        }}
        search={search}
        onSearch={(next) => {
          setSearch(next);
          setPage(1);
          clearSelection();
        }}
        sort={sort}
        onSort={() => setSort((current) => (current === 'desc' ? 'asc' : 'desc'))}
        onPage={(next) => {
          setPage(next);
          clearSelection();
        }}
        selected={selected}
        onSelect={setSelected}
      />
    </AdminPage>
  );
}

function ExportButton({
  count,
  disabled,
  onExport,
}: {
  count: number;
  disabled: boolean;
  onExport: () => void;
}) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onExport}
      {...hoverProps}
      className={adminButton.secondary}
    >
      <AdminIcon ref={iconRef} name="Download01" />
      {count > 0 ? `Export ${count} selected` : 'Export CSV'}
    </button>
  );
}

/**
 * The five headline cards (404:776–404:801). "Not connected yet" only where the source serves no
 * figures (`null`); a failed load says so and offers a retry.
 */
function Stats({
  stats,
  failed,
  onRetry,
}: {
  stats: AdminUserStats | null | undefined;
  failed: boolean;
  onRetry: () => void;
}) {
  const value = (pick: (s: AdminUserStats) => string) =>
    failed ? '—' : stats === undefined ? undefined : stats ? pick(stats) : '—';
  const unserved = failed ? 'Couldn’t load' : stats === null ? 'Not connected yet' : undefined;
  const growth = (count: number) =>
    stats && count > 0 ? <TrendBadge up>{formatCount(count)}</TrendBadge> : undefined;
  return (
    <div className={cn('grid grid-cols-2 gap-4 @min-[1000px]/admin:grid-cols-5')}>
      <StatCard
        icon="Users01"
        title="Total users"
        value={value((s) => formatCount(s.total))}
        badge={growth(stats?.newLast30 ?? 0)}
        caption={
          failed ? <RetryCaption onRetry={onRetry} /> : (unserved ?? 'new in the last 30 days')
        }
      />
      <StatCard
        title="Active, 30 days"
        value={value((s) => formatCount(s.active30))}
        badge={stats?.active30Delta && <DeltaBadge delta={stats.active30Delta} />}
        caption={unserved ?? 'signed in at least once'}
      />
      <StatCard
        icon="CreditCard02"
        title="Pro subscribers"
        value={value((s) => formatCount(s.pro))}
        badge={growth(stats?.proNew ?? 0)}
        caption={unserved ?? (stats ? `comped: ${stats.comped}` : '')}
      />
      <StatCard
        icon="UserX01"
        title="Suspended"
        value={value((s) => formatCount(s.suspended))}
        caption={
          unserved ??
          (stats
            ? `abuse ${stats.suspendedBy.abuse} · fraud ${stats.suspendedBy.fraud} · other ${stats.suspendedBy.other}`
            : '')
        }
      />
      <StatCard
        title="Pending deletion"
        value={value((s) => formatCount(s.pendingDeletion))}
        caption={
          unserved ??
          (stats?.nextDeletionDueInDays != null
            ? `next due in ${stats.nextDeletionDueInDays} days`
            : 'none due')
        }
      />
    </div>
  );
}
