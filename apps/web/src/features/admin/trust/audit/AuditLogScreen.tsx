'use client';

import { useDeferredValue, useState } from 'react';

import {
  AUDIT_TARGET_LABEL,
  EMPTY_AUDIT_FILTERS,
  type AuditFilters,
  type AuditRange,
  type AuditTargetType,
} from '@nextkin/shared/models';
import { exportAudit, useAuditLog } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { formatCount } from '../../format';
import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty } from '../../ui/AdminCard';
import { adminButton } from '../../ui/adminButton';
import { FieldLabel } from '../../ui/AdminForm';
import { AdminPage } from '../../ui/AdminPage';
import { Pager } from '../../ui/AdminTable';
import { SearchField } from '../../ui/SearchField';
import { SelectInput } from '../SelectInput';
import { downloadText, formatRange } from '../trustFormat';
import { AuditTable } from './AuditTable';

const RANGES: { id: AuditRange; label: string; days: number | null }[] = [
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '90d', label: 'Last 90 days', days: 90 },
  { id: 'all', label: 'All time', days: null },
];

const TARGETS = Object.keys(AUDIT_TARGET_LABEL) as AuditTargetType[];

/**
 * The audit log (Figma 408:1531): every staff action, who did it, to what, and why. Append-only:
 * no row can be edited or deleted, and a copy is exported nightly to locked storage. The filters
 * narrow the rows and Export CSV writes exactly the filtered rows.
 */
export function AuditLogScreen() {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [page, setPage] = useState(1);
  const search = useDeferredValue(filters.search);
  const applied = { ...filters, search };
  const log = useAuditLog(applied, page);
  const data = log.data;

  const set =
    <K extends keyof AuditFilters>(key: K) =>
    (value: AuditFilters[K]) => {
      setFilters((current) => ({ ...current, [key]: value }));
      setPage(1);
    };

  const onExport = async () => {
    try {
      const file = await exportAudit(applied);
      if (file.kind === 'csv') downloadText('nextkin-audit-log.csv', file.csv);
      else window.location.assign(file.url);
    } catch {
      showToast('The export didn’t download. Try again.', { tone: 'error' });
    }
  };

  const range = RANGES.find((r) => r.id === filters.range) ?? RANGES[1]!;
  const changed = JSON.stringify(filters) !== JSON.stringify(EMPTY_AUDIT_FILTERS);

  return (
    <AdminPage
      title="Audit log"
      subtitle="Every staff action, who did it, to what, and why."
      actions={<ExportButton disabled={!data} onClick={() => void onExport()} />}
    >
      <p className="flex items-center gap-3 rounded-md border border-brand-100 bg-brand-50 px-4 py-3.5 text-body-s text-brand-700">
        <AdminIcon name="Lock01" />
        Append-only. Nothing here can be edited or deleted. A copy is exported nightly to locked
        storage.
      </p>

      <div
        role="search"
        aria-label="Filter the audit log"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-surface-card p-4 shadow-xs"
      >
        <SelectInput
          label="Date range"
          icon="Calendar"
          className="w-[280px]"
          options={RANGES}
          value={filters.range}
          display={formatRange(range.days)}
          onChange={set('range')}
        />
        <SelectInput
          label="Staff"
          className="w-[200px]"
          options={[
            { id: 'all', label: 'All staff' },
            ...(data?.staffOptions.map((s) => ({ id: s.id, label: s.name })) ?? []),
          ]}
          value={filters.staff}
          onChange={set('staff')}
        />
        <SelectInput
          label="Action"
          className="w-[220px]"
          options={[
            { id: 'all', label: 'All actions' },
            ...(data?.actionOptions.map((a) => ({ id: a, label: a })) ?? []),
          ]}
          value={filters.action}
          onChange={set('action')}
        />
        <SelectInput<AuditTargetType | 'all'>
          label="Target type"
          className="w-[200px]"
          options={[
            { id: 'all', label: 'All targets' },
            ...TARGETS.map((t) => ({ id: t, label: AUDIT_TARGET_LABEL[t] })),
          ]}
          value={filters.targetType}
          onChange={set('targetType')}
        />
        <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
          <FieldLabel>Search</FieldLabel>
          <SearchField
            value={filters.search}
            onChange={set('search')}
            placeholder="Target ID, reason or IP"
            label="Search the audit log"
            className="h-11 w-full"
          />
        </div>
        {/* Always at full strength, as the board draws it (408:1735); with nothing set it does
            nothing. */}
        <button
          type="button"
          onClick={() => {
            setFilters(EMPTY_AUDIT_FILTERS);
            setPage(1);
          }}
          className={adminButton.secondary}
        >
          Clear
        </button>
      </div>

      <AdminCard
        icon="ClipboardCheck"
        title="Events"
        trailing={
          data && (
            <AdminBadge tone="neutral">
              {data.total === null
                ? `${formatCount(data.loaded ?? data.rows.length)}+ shown`
                : `${formatCount(data.total)} in range`}
            </AdminBadge>
          )
        }
        bodyClassName="p-0"
      >
        {log.isPending ? (
          <div aria-hidden className="flex flex-col gap-4 p-6">
            {Array.from({ length: 12 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : log.isError ? (
          <StateView
            tone="danger"
            title="Couldn’t load the audit log"
            actionLabel="Try again"
            onAction={() => void log.refetch()}
          />
        ) : data && data.rows.length === 0 ? (
          <CardEmpty
            title={changed ? 'No events match these filters' : 'No staff actions yet'}
            message={
              changed
                ? 'Widen the date range or clear the filters.'
                : 'Every staff action is recorded here.'
            }
          />
        ) : (
          data && (
            <>
              <div className="overflow-x-auto">
                <AuditTable rows={data.rows} />
              </div>
              <Pager page={page} pages={data.pages} onPage={setPage} />
            </>
          )
        )}
      </AdminCard>
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
      Export CSV
    </button>
  );
}
