'use client';

import { useDeferredValue, useState } from 'react';

import {
  FAILURE_KIND_LABEL,
  type FailureFilter,
  type FailureKind,
  type FailureQuery,
  type FailureStatus,
} from '@nextkin/shared/models';
import {
  exportFailures,
  useFailureStats,
  useFailures,
  useResolveFailure,
  useRetryFailures,
} from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { formatCount } from '../../format';
import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { adminButton } from '../../ui/adminButton';
import { AdminPage } from '../../ui/AdminPage';
import { Pager, TableToolbar } from '../../ui/AdminTable';
import { ButtonGroup } from '../../ui/ButtonGroup';
import { SearchField } from '../../ui/SearchField';
import { CheckFilter } from '../CheckFilter';
import { downloadText, masked } from '../trustFormat';
import { FailureStatCards } from './FailureStatCards';
import { FailuresTable } from './FailuresTable';
import { RunDrawer } from './RunDrawer';

const KINDS = Object.keys(FAILURE_KIND_LABEL) as FailureKind[];

/** What an empty tab says, when no search or filter narrows it. */
const EMPTY: Record<FailureFilter, { title: string; message: string }> = {
  open: { title: 'No open runs', message: 'Every failed run is retrying or resolved.' },
  retrying: { title: 'No runs retrying', message: 'Runs you retry show here until they finish.' },
  resolved: { title: 'No resolved runs', message: 'Runs marked resolved show here.' },
  all: { title: 'No failed runs', message: 'Runs that fail after every retry show here.' },
};

/**
 * Generation failures (Figma 406:1195): AI runs that failed after every automatic retry. The four
 * cards say how many, how many are open, how many a manual retry saved and the commonest cause;
 * the table lists the runs, and a run opens in the drawer (406:1691). Retrying or resolving is
 * audited on the server.
 *
 * The board highlights the Open tab while listing runs of every status on "Page 1 of 52" of 461,
 * which is the All view; the page opens on All so its rows are the board's (`toreview.md` §171).
 */
export function FailuresScreen() {
  const [status, setStatus] = useState<FailureFilter>('all');
  const [search, setSearch] = useState('');
  const [kinds, setKinds] = useState<FailureKind[]>([]);
  const [page, setPage] = useState(1);
  // Each ticked run with its status when last seen, so Retry selected only sends open runs.
  const [selected, setSelected] = useState<Map<string, FailureStatus>>(new Map());
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [busy, setBusy] = useState<'retry' | 'resolve' | null>(null);

  const deferred = useDeferredValue(search);
  const query: FailureQuery = { status, search: deferred, kinds, page };
  const stats = useFailureStats();
  const failures = useFailures(query);
  const retry = useRetryFailures();
  const resolve = useResolveFailure();

  const list = failures.data;
  const notServed = failures.isSuccess && list === null;
  // A run resolved or retried away from this tab can leave the page past the last one.
  const shownPage = list ? Math.min(page, list.pages) : page;
  const statusOf = (id: string) =>
    list?.rows.find((row) => row.id === id)?.status ?? selected.get(id);
  const retriable = [...selected.keys()].filter((id) => statusOf(id) === 'open');
  const filtered = deferred.trim() !== '' || kinds.length > 0;

  const reset =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  const onSelect = (ids: string[], on: boolean) =>
    setSelected((current) => {
      const next = new Map(current);
      for (const id of ids) {
        const status = list?.rows.find((row) => row.id === id)?.status;
        if (on && status) next.set(id, status);
        else next.delete(id);
      }
      return next;
    });

  /** Retries runs; `bulk` is Retry selected, which skips ticked runs that aren't open. */
  const runRetry = async (ids: string[], bulk = false) => {
    setBusy('retry');
    try {
      await retry.mutateAsync(ids);
      const skipped = bulk ? selected.size - ids.length : 0;
      const queued =
        ids.length === 1
          ? `Retry queued for ${masked('run', ids[0]!)}`
          : `Retries queued for ${ids.length} runs`;
      showToast(
        skipped > 0
          ? `${queued}. ${skipped} ticked ${skipped === 1 ? 'run wasn’t' : 'runs weren’t'} open.`
          : queued,
      );
      if (bulk) setSelected(new Map());
    } catch (error) {
      // The server says why a run couldn't be retried (the user's plan limit, say): show that.
      const why = error instanceof Error && !('status' in error) ? error.message : '';
      showToast(why || 'The retry wasn’t queued. Try again.', { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const runResolve = async (id: string) => {
    setBusy('resolve');
    try {
      await resolve.mutateAsync(id);
      setSelected((current) => (current.has(id) ? new Map(current).set(id, 'resolved') : current));
      showToast(`${masked('run', id)} marked resolved`);
    } catch {
      showToast('That run wasn’t resolved. Try again.', { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const onExport = async () => {
    try {
      downloadText('nextkin-generation-failures.csv', await exportFailures({ ...query, page: 1 }));
    } catch {
      showToast('The export didn’t download. Try again.', { tone: 'error' });
    }
  };

  const tabs: { id: FailureFilter; label: string; count?: number; countTone?: 'brand' }[] = [
    {
      id: 'open',
      label: 'Open',
      countTone: 'brand' as const,
      ...(list ? { count: list.counts.open } : {}),
    },
    { id: 'retrying', label: 'Retrying' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'all', label: 'All' },
  ];

  return (
    <AdminPage
      title="Generation failures"
      subtitle="AI runs that failed after every automatic retry. Retrying or resolving a run is audited."
      actions={
        <>
          <HeaderButton
            icon="RefreshCw01"
            label="Retry selected"
            disabled={retriable.length === 0 || busy !== null}
            onClick={() => void runRetry(retriable, true)}
          />
          <HeaderButton
            icon="Download01"
            label="Export"
            disabled={!list}
            onClick={() => void onExport()}
          />
        </>
      }
    >
      <FailureStatCards
        stats={stats.data}
        loading={stats.isPending}
        failed={stats.isError}
        onRetry={() => void stats.refetch()}
      />

      <AdminCard
        icon="FileX02"
        title="Failed runs"
        trailing={list && <AdminBadge tone="neutral">{formatCount(list.counts.all)}</AdminBadge>}
        bodyClassName="p-0"
      >
        <TableToolbar>
          <ButtonGroup
            label="Run status"
            size="md"
            options={tabs}
            value={status}
            onChange={reset(setStatus)}
          />
          <span className="flex-1" />
          <SearchField
            value={search}
            onChange={reset(setSearch)}
            placeholder="Run ID, user ID or error code"
            className="w-[320px]"
          />
          <CheckFilter
            options={KINDS.map((kind) => ({ id: kind, label: FAILURE_KIND_LABEL[kind] }))}
            value={kinds}
            onChange={reset(setKinds)}
          />
        </TableToolbar>

        {failures.isPending ? (
          <div aria-hidden className="flex flex-col gap-4 p-6">
            {Array.from({ length: 9 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : failures.isError ? (
          <StateView
            tone="danger"
            title="Couldn’t load the failed runs"
            actionLabel="Try again"
            onAction={() => void failures.refetch()}
          />
        ) : notServed ? (
          <NotConnected what="the failure queue" />
        ) : list && list.rows.length === 0 ? (
          <CardEmpty
            title={filtered ? 'No matching runs' : EMPTY[status].title}
            message={
              filtered ? 'Try another run ID, user ID, error code or kind.' : EMPTY[status].message
            }
          />
        ) : (
          list && (
            <>
              <div className="overflow-x-auto">
                <FailuresTable
                  rows={list.rows}
                  selected={new Set(selected.keys())}
                  onSelect={onSelect}
                  onOpen={setOpenRun}
                  onRetry={(id) => void runRetry([id])}
                  onResolve={(id) => void runResolve(id)}
                />
              </div>
              <Pager page={shownPage} pages={list.pages} onPage={setPage} />
            </>
          )
        )}
      </AdminCard>

      <RunDrawer
        runId={openRun}
        onClose={() => setOpenRun(null)}
        onRetry={(id) => void runRetry([id])}
        onResolve={(id) => void runResolve(id)}
        busy={busy}
      />
    </AdminPage>
  );
}

function HeaderButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: AdminIconName;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      {...hoverProps}
      className={adminButton.secondary}
    >
      <AdminIcon ref={iconRef} name={icon} />
      {label}
    </button>
  );
}
