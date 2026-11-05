'use client';

import { useDeferredValue, useState } from 'react';

import type {
  AdminDeletionFilter,
  AdminDeletionRequest,
  AdminDeletionStats,
} from '@nextkin/shared/models';
import { useAdminDeletions, useAdminDeletionStats, useAdminMe } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { AdminPage } from '../../ui/AdminPage';
import { adminTable, Pager, TableToolbar } from '../../ui/AdminTable';
import { ButtonGroup } from '../../ui/ButtonGroup';
import { SearchField } from '../../ui/SearchField';
import { StatCard } from '../../ui/StatCard';
import { DeletionRow } from '../components/DeletionRow';
import { Notice } from '../components/Notice';
import { RetryCaption } from '../components/StatsCaption';
import { ProcessDeletionDialog } from '../dialogs/ProcessDeletionDialog';
import { formatShortDate } from '../peopleFormat';

/** Rows per page (Figma 408:2843 draws six, "Page 1 of 4" for 21). */
const PAGE_SIZE = 6;

/**
 * The search matches what a row shows, the last four characters of the user ID, or a whole ID
 * pasted in, never the hidden middle of one.
 */
const matchesId = (request: AdminDeletionRequest, q: string) => {
  const id = request.userId.toLowerCase();
  return !q || id.slice(-4).includes(q) || id === q;
};

/**
 * Deletion requests (Figma 408:2745): accounts waiting to be purged, how close each is to the
 * 30-day limit, and the completed ones. "Process now" starts the purge early, with a reason for
 * the audit log.
 */
export function DeletionRequestsScreen() {
  const stats = useAdminDeletionStats();
  const all = useAdminDeletions('all');
  const me = useAdminMe();
  const canProcess = me.data?.permissions.includes('users.manage') ?? false;
  const [filter, setFilter] = useState<AdminDeletionFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [processing, setProcessing] = useState<AdminDeletionRequest | null>(null);
  const q = useDeferredValue(search)
    .trim()
    .toLowerCase()
    .replace(/^user\s*·*\s*/, '');

  const requests = all.data ?? [];
  const open = requests.filter((r) => r.status !== 'completed');
  const done = requests.filter((r) => r.status === 'completed');
  const matched = (filter === 'open' ? open : filter === 'completed' ? done : requests).filter(
    (r) => matchesId(r, q),
  );
  const pages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const at = Math.min(page, pages);
  const rows = matched.slice((at - 1) * PAGE_SIZE, at * PAGE_SIZE);
  const retry = () => {
    void stats.refetch();
    void all.refetch();
  };

  return (
    <AdminPage
      title="Deletion requests"
      subtitle="Accounts waiting to be purged. Every owned row is gone within 30 days of the request."
    >
      <DeletionStats
        stats={stats.isPending || stats.isError ? undefined : stats.data}
        failed={stats.isError}
        onRetry={() => void stats.refetch()}
      />

      <AdminCard
        icon="Trash01"
        title="All requests"
        trailing={all.data && <AdminBadge tone="neutral">{requests.length}</AdminBadge>}
        bodyClassName="p-0"
      >
        <TableToolbar>
          <ButtonGroup
            label="Show"
            size="md"
            value={filter}
            onChange={(next) => {
              setFilter(next);
              setPage(1);
            }}
            options={[
              { id: 'all', label: 'All' },
              { id: 'open', label: 'Open', ...(all.data ? { count: open.length } : {}) },
              { id: 'completed', label: 'Completed', ...(all.data ? { count: done.length } : {}) },
            ]}
          />
          <span className="flex-1" />
          <SearchField
            value={search}
            onChange={(next) => {
              setSearch(next);
              setPage(1);
            }}
            placeholder="Masked user ID"
            label="Search by the last characters of a user ID"
            className="w-[280px]"
          />
        </TableToolbar>

        {all.isPending ? (
          <div aria-hidden className="flex flex-col gap-3 p-6">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : all.isError ? (
          <StateView
            tone="danger"
            title="Couldn’t load deletion requests"
            actionLabel="Try again"
            onAction={retry}
          />
        ) : all.data === null ? (
          <NotConnected what="the deletion queue" />
        ) : rows.length === 0 ? (
          <CardEmpty
            title={requests.length ? 'No requests match' : 'No deletion requests'}
            message={
              requests.length
                ? 'Try another ID or tab.'
                : 'Requests show here when someone asks to delete their account.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className={cn(adminTable.table, 'min-w-[1000px]')}>
              <thead className={adminTable.head}>
                <tr>
                  <th scope="col" className={adminTable.th}>
                    User
                  </th>
                  <th scope="col" className={cn(adminTable.th, 'w-[186px]')}>
                    Requested on
                  </th>
                  <th scope="col" className={cn(adminTable.th, 'w-[186px]')}>
                    Due by
                  </th>
                  <th scope="col" className={cn(adminTable.th, 'w-[166px]')}>
                    Days left
                  </th>
                  <th scope="col" className={cn(adminTable.th, 'w-[236px]')}>
                    Status
                  </th>
                  {/* The board's 120px button column inside 16px of padding each side. */}
                  <th scope="col" className={cn(adminTable.th, 'w-[152px]')}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((request) => (
                  <DeletionRow
                    key={request.id}
                    request={request}
                    canProcess={canProcess}
                    onProcess={() => setProcessing(request)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {all.data && rows.length > 0 && <Pager page={at} pages={pages} onPage={setPage} />}
      </AdminCard>

      <Notice tone="info" icon="InfoCircle">
        The account is signed out everywhere when deletion is requested, and every owned row is
        purged within 30 days. Backups age out on their own retention schedule.
      </Notice>

      <ProcessDeletionDialog request={processing} onClose={() => setProcessing(null)} />
    </AdminPage>
  );
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * The four cards (408:2843). "Not connected yet" only for a source that serves no queue (`null`);
 * a failed load says so with a retry. An overdue request is named in the Due card, never hidden.
 */
function DeletionStats({
  stats,
  failed,
  onRetry,
}: {
  stats: AdminDeletionStats | null | undefined;
  failed: boolean;
  onRetry: () => void;
}) {
  const value = (text: (s: AdminDeletionStats) => string) =>
    failed || stats === null ? '—' : stats === undefined ? undefined : text(stats);
  const caption = (text: (s: AdminDeletionStats) => string, withRetry = false) => {
    if (failed) return withRetry ? <RetryCaption onRetry={onRetry} /> : 'Couldn’t load';
    return stats ? text(stats) : 'Not connected yet';
  };
  return (
    <div className="grid grid-cols-2 gap-4 @min-[1000px]/admin:grid-cols-4">
      <StatCard
        icon="Hourglass01"
        title="Open"
        value={value((s) => String(s.open))}
        caption={caption(
          (s) =>
            s.oldestOpenAt ? `oldest requested ${formatShortDate(s.oldestOpenAt)}` : 'none open',
          true,
        )}
      />
      <StatCard
        icon="Clock"
        title="Due in 7 days"
        value={value((s) => String(s.dueIn7Days))}
        caption={caption((s) => {
          const overdue = s.overdue > 0 ? `${plural(s.overdue, 'request')} overdue` : null;
          const next = s.nextDueAt ? `next due ${formatShortDate(s.nextDueAt)}` : null;
          return [overdue, next].filter(Boolean).join(' · ') || 'nothing due';
        })}
      />
      <StatCard
        icon="CheckCircle"
        title="Completed in 30 days"
        value={value((s) => String(s.completed30))}
        caption={caption((s) =>
          s.completedPastLimit > 0
            ? `${s.completedPastLimit} past the limit`
            : s.completed30 > 0
              ? 'all inside the 30-day limit'
              : 'none completed yet',
        )}
      />
      <StatCard
        icon="Activity"
        title="Average time to purge"
        value={value((s) => (s.averageDays != null ? `${s.averageDays} days` : '—'))}
        caption={caption(() => 'from request to last row')}
      />
    </div>
  );
}
