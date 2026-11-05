'use client';

import { useDeferredValue, useState } from 'react';

import type { KbTab, Technology } from '@nextkin/shared/models';
import { useKbStats, useTechnologies } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';
import { FilterCheckboxItem, FilterDropdown } from '@/ui/FilterDropdown';
import { chevronTurn, menuTrigger } from '@/ui/menuMotion';
import { Skeleton } from '@/ui/Skeleton';
import { Soon } from '@/ui/Soon';
import { StateView } from '@/ui/StateView';

import { AdminBadge, TrendBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty } from '../../ui/AdminCard';
import { adminButton, adminSoon } from '../../ui/adminButton';
import { AdminPage } from '../../ui/AdminPage';
import { Pager } from '../../ui/AdminTable';
import { SearchField } from '../../ui/SearchField';
import { StatCard } from '../../ui/StatCard';
import { formatCount, formatDay } from '../format';
import { emptyCopy } from '../technologies/emptyCopy';
import { ImportDialog } from '../technologies/ImportDialog';
import { TechnologiesTable } from '../technologies/TechnologiesTable';
import { TechnologyDialog } from '../technologies/TechnologyDialog';
import { ActionButton, UnderlineTabs } from '../ui/ContentBits';

const DATASETS = ['v2026.11', 'v2026.10'];

/**
 * Technology KB (Figma 409:1872): the versions, release dates and aliases the engine reads resumes
 * and jobs with. Every add, edit and import goes through the review queue; nothing here publishes
 * directly.
 */
export function TechnologiesScreen() {
  const stats = useKbStats();
  const [tab, setTab] = useState<KbTab>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [dataset, setDataset] = useState<string | null>(null);
  // The board's own order until a header is clicked.
  const [sort, setSort] = useState<'asc' | 'desc' | null>(null);
  const deferred = useDeferredValue(query);
  const list = useTechnologies({ tab, query: deferred, page, dataset, sort });
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<Technology | null>(null);

  const s = stats.data;
  // Sorted by the repository before paging, so the order runs across pages.
  const rows = list.data?.rows ?? [];
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
  const at = (next: () => void) => {
    next();
    setPage(1);
  };

  return (
    <AdminPage
      title="Technology KB"
      subtitle="Versions, release dates and aliases the engine uses to read resumes and jobs. Every edit goes through the review queue."
      actions={
        <div className="flex gap-3">
          <ActionButton icon="UploadCloud02" onClick={() => setImporting(true)}>
            Import CSV / JSON
          </ActionButton>
          <ActionButton variant="primary" icon="Plus" onClick={() => setAdding(true)}>
            Add technology
          </ActionButton>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4 @min-[1100px]/admin:grid-cols-4">
        <StatCard
          icon="Database01"
          title="Technologies"
          value={s ? formatCount(s.technologies.total) : stats.isError ? '—' : undefined}
          badge={
            s?.technologies.added30d != null && (
              <TrendBadge up>{s.technologies.added30d}</TrendBadge>
            )
          }
          caption={s?.technologies.added30d != null ? 'added in the last 30 days' : 'in the KB'}
        />
        <StatCard
          icon="ClipboardCheck"
          title="Review queue"
          value={s ? formatCount(s.review.total) : stats.isError ? '—' : undefined}
          caption={
            s?.review.fromImports != null && s.review.staffEdits != null
              ? `${s.review.fromImports} from imports · ${s.review.staffEdits} staff edits`
              : 'changes waiting'
          }
        />
        <StatCard
          icon="Flag01"
          title="User reports"
          value={s ? formatCount(s.reports.total) : stats.isError ? '—' : undefined}
          caption={
            s?.reports.dates != null && s.reports.aliases != null
              ? `${s.reports.dates} dates · ${s.reports.aliases} aliases disputed`
              : 'reported by users'
          }
        />
        <StatCard
          icon="Archive"
          title="Dataset"
          value={s ? (s.dataset?.version ?? '—') : stats.isError ? '—' : undefined}
          caption={
            s?.dataset?.closedAt && s.dataset.nextAt
              ? `closed ${formatDay(s.dataset.closedAt, false)} · next ${formatDay(s.dataset.nextAt, false)}`
              : 'current dataset version'
          }
        />
      </div>

      <AdminCard
        icon="BookOpen01"
        title="Technologies"
        trailing={s && <AdminBadge tone="neutral">{formatCount(s.technologies.total)}</AdminBadge>}
        bodyClassName="p-0"
      >
        <UnderlineTabs
          label="Technologies to show"
          className="px-5 pt-3.5"
          value={tab}
          onChange={(next) => at(() => setTab(next))}
          options={[
            { id: 'all', label: 'All technologies', count: s?.tabs.all },
            { id: 'review', label: 'Review queue', count: s?.tabs.review },
            { id: 'reports', label: 'User reports', count: s?.tabs.reports },
            { id: 'imports', label: 'Imports', count: s?.tabs.imports },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 py-3.5 pl-5 pr-4">
          <SearchField
            value={query}
            onChange={(next) => at(() => setQuery(next))}
            placeholder="Search technologies or aliases"
            className="w-[360px]"
          />
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
          <span className="flex-1" />
          {list.data && (
            <span className="text-body-s text-text-secondary" aria-live="polite">
              Showing {formatCount(list.data.rows.length)} of {formatCount(list.data.total)}
            </span>
          )}
          <FilterDropdown
            align="end"
            trigger={
              <button type="button" className={cn(adminButton.secondary, menuTrigger)}>
                <AdminIcon name="Archive" />
                {dataset ? `Dataset ${dataset}` : 'All datasets'}
                <AdminIcon
                  name="ChevronDown"
                  size="sm"
                  className={cn('text-neutral-500', chevronTurn)}
                />
              </button>
            }
          >
            <FilterCheckboxItem
              checked={dataset === null}
              onCheckedChange={() => at(() => setDataset(null))}
              closeOnSelect
            >
              All datasets
            </FilterCheckboxItem>
            {DATASETS.map((d) => (
              <FilterCheckboxItem
                key={d}
                checked={dataset === d}
                onCheckedChange={() => at(() => setDataset(d))}
                closeOnSelect
              >
                Dataset {d}
              </FilterCheckboxItem>
            ))}
          </FilterDropdown>
        </div>
        {list.isPending ? (
          <div aria-hidden className="flex flex-col gap-3 p-6">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : list.isError ? (
          <StateView
            tone="danger"
            title="Couldn’t load the KB"
            actionLabel="Try again"
            onAction={() => void list.refetch()}
          />
        ) : rows.length === 0 ? (
          <CardEmpty {...emptyCopy({ page, query: deferred, tab, dataset })} />
        ) : (
          <TechnologiesTable
            rows={rows}
            sort={sort}
            onSort={() => at(() => setSort((d) => (d === 'asc' ? 'desc' : 'asc')))}
            onEdit={setEditing}
          />
        )}
        {list.data && list.data.total > 0 && <Pager page={page} pages={pages} onPage={setPage} />}
      </AdminCard>

      <TechnologyDialog
        key={adding ? 'new' : 'closed'}
        open={adding}
        onOpenChange={setAdding}
        editing={null}
      />
      {editing && (
        <TechnologyDialog
          key={editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          editing={editing}
        />
      )}
      <ImportDialog open={importing} onOpenChange={setImporting} />
    </AdminPage>
  );
}
