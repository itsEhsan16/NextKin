'use client';

import { useDeferredValue, useState } from 'react';

import {
  REPORT_CATEGORY_LABEL,
  type ReportAction,
  type ReportCategory,
  type ReportFilter,
} from '@nextkin/shared/models';
import { exportReports, useReport, useReportStats, useReports } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
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
import { RetryCaption } from '../../people/components/StatsCaption';
import { StatCard } from '../../ui/StatCard';
import { CheckFilter } from '../CheckFilter';
import { downloadText } from '../trustFormat';
import { ReportActionDialog } from './ReportActionDialog';
import { ReportCard } from './ReportCard';
import { ReportsTable } from './ReportsTable';

const CATEGORIES = Object.keys(REPORT_CATEGORY_LABEL) as ReportCategory[];

/** What an empty tab says, when no search or category narrows it. */
const EMPTY: Record<ReportFilter, { title: string; message: string }> = {
  open: { title: 'No open reports', message: 'Every report has been settled.' },
  resolved: { title: 'No settled reports', message: 'Reports you settle show here.' },
  all: { title: 'No reports', message: 'Reports about shared resumes and links show here.' },
};

/**
 * Abuse reports (Figma 407:946): reports about shared resumes and public links. Reporters stay
 * anonymous, and every decision asks for a reason and is audited. The table sits beside the card
 * for the report in focus, the newest open one to begin with.
 *
 * As on Generation failures, the board highlights Open while listing every status (page 1 of 2 of
 * 16), so the page opens on All (`toreview.md` §171).
 */
export function AbuseReportsScreen() {
  const [filter, setFilter] = useState<ReportFilter>('all');
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [page, setPage] = useState(1);
  const [chosen, setChosen] = useState<string | null>(null);
  const [acting, setActing] = useState<{ id: string; action: ReportAction } | null>(null);

  const deferred = useDeferredValue(search);
  const stats = useReportStats();
  const reports = useReports(filter, deferred, page, categories);
  const list = reports.data;
  const focusedId =
    chosen ?? list?.rows.find((row) => row.status === 'open')?.id ?? list?.rows[0]?.id ?? null;
  const focused = useReport(focusedId);
  const acted = useReport(acting?.id ?? null);
  // The report query keeps the last report while the next loads; a decision must only ever be
  // offered on the report it names.
  const actedReport = acted.data?.id === acting?.id ? acted.data : undefined;
  const shownPage = list ? Math.min(page, list.pages) : page;
  const filtered = deferred.trim() !== '' || categories.length > 0;

  const tabs: { id: ReportFilter; label: string; count?: number; countTone?: 'brand' }[] = [
    {
      id: 'open',
      label: 'Open',
      countTone: 'brand' as const,
      ...(list ? { count: list.counts.open } : {}),
    },
    { id: 'resolved', label: 'Resolved' },
    { id: 'all', label: 'All' },
  ];

  const onExport = async () => {
    try {
      downloadText('nextkin-abuse-reports.csv', await exportReports(filter, deferred, categories));
    } catch {
      showToast('The export didn’t download. Try again.', { tone: 'error' });
    }
  };

  const s = stats.data;
  const statsMissing = stats.isSuccess && s === null;

  return (
    <AdminPage
      title="Abuse reports"
      subtitle="Reports about shared resumes and public links. Reporters stay anonymous, and every decision is audited."
      actions={<ExportButton disabled={!list} onClick={() => void onExport()} />}
    >
      {statsMissing ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-1">
          <NotConnected what="report counts" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            icon="Flag01"
            title="Open"
            value={stats.isError ? '—' : s && formatCount(s.open)}
            caption={
              stats.isError ? <RetryCaption onRetry={() => void stats.refetch()} /> : s?.openNote
            }
          />
          <StatCard
            icon="CheckCircle"
            title="Resolved, 30 days"
            value={stats.isError ? '—' : s && formatCount(s.resolved30d)}
            caption={stats.isError ? 'Couldn’t load' : s?.resolvedNote}
          />
          <StatCard
            icon="Clock"
            title="Median time to resolve"
            value={
              stats.isError
                ? '—'
                : s && (s.medianResolveHours === null ? '—' : `${s.medianResolveHours} h`)
            }
            caption={stats.isError ? 'Couldn’t load' : s && `target under ${s.targetHours} h`}
          />
        </div>
      )}

      <div className="grid items-start gap-6 @admin-2xl/admin:grid-cols-[minmax(0,1fr)_400px]">
        <AdminCard
          icon="Flag01"
          title="Reports"
          trailing={list && <AdminBadge tone="neutral">{formatCount(list.counts.all)}</AdminBadge>}
          bodyClassName="p-0"
        >
          <TableToolbar>
            <ButtonGroup
              label="Report status"
              size="md"
              options={tabs}
              value={filter}
              onChange={(next) => {
                setFilter(next);
                setPage(1);
                setChosen(null);
              }}
            />
            <span className="flex-1" />
            <SearchField
              value={search}
              onChange={(next) => {
                setSearch(next);
                setPage(1);
                setChosen(null);
              }}
              placeholder="Report or item ID"
              className="w-[260px]"
            />
            <CheckFilter
              options={CATEGORIES.map((category) => ({
                id: category,
                label: REPORT_CATEGORY_LABEL[category],
              }))}
              value={categories}
              onChange={(next) => {
                setCategories(next);
                setPage(1);
                setChosen(null);
              }}
            />
          </TableToolbar>
          {reports.isPending ? (
            <div aria-hidden className="flex flex-col gap-4 p-6">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : reports.isError ? (
            <StateView
              tone="danger"
              title="Couldn’t load the reports"
              actionLabel="Try again"
              onAction={() => void reports.refetch()}
            />
          ) : list === null ? (
            <NotConnected what="abuse reports" />
          ) : list && list.rows.length === 0 ? (
            <CardEmpty
              title={filtered ? 'No matching reports' : EMPTY[filter].title}
              message={
                filtered
                  ? 'Try another report or item ID, or another category.'
                  : EMPTY[filter].message
              }
            />
          ) : (
            list && (
              <>
                <div className="overflow-x-auto">
                  <ReportsTable
                    rows={list.rows}
                    focused={focusedId}
                    onFocus={setChosen}
                    onAct={(id, action) => {
                      setChosen(id);
                      setActing({ id, action });
                    }}
                  />
                </div>
                <Pager page={shownPage} pages={list.pages} onPage={setPage} />
              </>
            )
          )}
        </AdminCard>

        {list && list.rows.length > 0 && (
          <ReportCard
            report={focused.data ?? undefined}
            onAct={(id, action) => {
              // Keep the card on this report once it is settled, rather than the next open one.
              setChosen(id);
              setActing({ id, action });
            }}
          />
        )}
      </div>

      {acting && actedReport && (
        <ReportActionDialog
          report={actedReport}
          action={acting.action}
          onClose={() => setActing(null)}
        />
      )}
    </AdminPage>
  );
}

function ExportButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      {...hoverProps}
      className={adminButton.secondary}
    >
      <AdminIcon ref={iconRef} name="Download01" />
      Export
    </button>
  );
}
