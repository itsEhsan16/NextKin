'use client';

import { useDeferredValue, useState } from 'react';

import type { SkillsAliasFilter } from '@nextkin/shared/models';
import { useSkills, useSkillsOverview } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';
import { Skeleton } from '@/ui/Skeleton';
import { Soon } from '@/ui/Soon';
import { StateView } from '@/ui/StateView';

import { downloadCsv } from '../../exportCsv';
import { TrendBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { adminButton, adminSoon } from '../../ui/adminButton';
import { AdminPage } from '../../ui/AdminPage';
import { Pager, TableToolbar } from '../../ui/AdminTable';
import { ButtonGroup } from '../../ui/ButtonGroup';
import { SearchField } from '../../ui/SearchField';
import { StatCard } from '../../ui/StatCard';
import { formatCount } from '../format';
import { AddSkillDialog } from '../skills/AddSkillDialog';
import { TaxonomyCard, UnmappedCard, WhoCanEditCard } from '../skills/SkillsSide';
import { MergesCard, SkillsTable } from '../skills/SkillsTable';
import { ActionButton } from '../ui/ContentBits';

/**
 * Skills & aliases (Figma 406:1829): the taxonomy resume parsing and the ATS check map skills to.
 * Pick a category to see its skills; map this week's unmatched terms, and merge or dismiss the
 * aliases parsing suggests. Every edit and merge is audited. Not served by the backend yet, so on
 * the real API the page says so.
 */
export function SkillsScreen() {
  const overview = useSkillsOverview();
  const [categoryId, setCategoryId] = useState('cloud');
  const [filter, setFilter] = useState<SkillsAliasFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  // The board's own order until the header is clicked.
  const [sort, setSort] = useState<'asc' | 'desc' | null>(null);
  const deferred = useDeferredValue(query);
  // The repo sorts before it pages, so the order holds across all 52 pages.
  const skills = useSkills({ categoryId, filter, query: deferred, page, sort });
  const [adding, setAdding] = useState(false);

  const data = overview.data;
  const category = data?.categories.find((c) => c.id === categoryId);
  const rows = skills.data?.rows ?? [];
  const pages = skills.data ? Math.max(1, Math.ceil(skills.data.total / skills.data.pageSize)) : 1;
  const reset = (next: () => void) => {
    next();
    setPage(1);
  };

  const header = (
    <div className="flex gap-3">
      {/* Bulk skills import has no route yet (the KB's import is technologies only). */}
      <Soon label="Importing skills is coming soon">
        <button type="button" aria-disabled="true" className={cn(adminButton.secondary, adminSoon)}>
          <AdminIcon name="UploadCloud02" />
          Import
        </button>
      </Soon>
      <ActionButton
        variant="primary"
        icon="Plus"
        onClick={() => setAdding(true)}
        disabled={!data?.categories.length}
      >
        Add skill
      </ActionButton>
    </div>
  );

  if (overview.isError) {
    return (
      <AdminPage title="Skills & aliases" actions={header}>
        <StateView
          tone="danger"
          title="Couldn’t load the taxonomy"
          actionLabel="Try again"
          onAction={() => void overview.refetch()}
        />
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="Skills & aliases"
      subtitle="The taxonomy that resume parsing and the ATS check map skills to. Every edit and merge is audited."
      actions={header}
    >
      {overview.isSuccess && data === null ? (
        <AdminCard icon="Tag01" title="Skills & aliases">
          <NotConnected what="the skills editor" />
        </AdminCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 @min-[1100px]/admin:grid-cols-4">
            <StatCard
              icon="Tag01"
              title="Skills"
              value={data ? formatCount(data.stats.skills) : undefined}
              badge={data && <TrendBadge up>{data.stats.added30d}</TrendBadge>}
              caption="added in the last 30 days"
            />
            <StatCard
              icon="Link01"
              title="Aliases"
              value={data ? formatCount(data.stats.aliases) : undefined}
              caption={data ? `${data.stats.perSkill} per skill on average` : undefined}
            />
            <StatCard
              icon="GitBranch01"
              title="Merge suggestions"
              value={data ? data.merges.length : undefined}
              caption="from resume parsing, last 30 days"
            />
            <StatCard
              icon="HelpCircle"
              title="Unmapped this week"
              value={data ? data.stats.unmapped : undefined}
              caption="terms the parser couldn’t match"
            />
          </div>

          <div className="grid items-start gap-6 @min-[1200px]/admin:grid-cols-[320px_minmax(0,1fr)]">
            <div className="grid gap-6 @min-[900px]/admin:grid-cols-2 @min-[1200px]/admin:grid-cols-1">
              {data ? (
                <>
                  <TaxonomyCard
                    overview={data}
                    categoryId={categoryId}
                    onCategory={(id) => reset(() => setCategoryId(id))}
                  />
                  <UnmappedCard overview={data} />
                </>
              ) : (
                <Skeleton className="h-[445px] rounded-lg" />
              )}
              <WhoCanEditCard />
            </div>

            <div className="flex min-w-0 flex-col gap-6">
              <AdminCard
                icon="Tag01"
                title={
                  category ? `${category.name} · ${formatCount(category.count)} skills` : 'Skills'
                }
                trailing={
                  <ActionButton
                    variant="small"
                    disabled={rows.length === 0}
                    onClick={() =>
                      downloadCsv(`nextkin-skills-${categoryId}.csv`, [
                        ['skill', 'aliases', 'parent', 'used_in_resumes'],
                        ...rows.map((r) => [r.name, r.aliases.join('; '), r.parent, r.usedIn]),
                      ])
                    }
                  >
                    Export
                  </ActionButton>
                }
                bodyClassName="p-0"
              >
                <TableToolbar>
                  <SearchField
                    value={query}
                    onChange={(next) => reset(() => setQuery(next))}
                    placeholder="Search skills or aliases"
                    className="w-[320px]"
                  />
                  <span className="flex-1" />
                  <ButtonGroup
                    label="Aliases"
                    size="md"
                    value={filter}
                    onChange={(next) => reset(() => setFilter(next))}
                    options={[
                      { id: 'all', label: 'All' },
                      { id: 'with', label: 'With aliases' },
                      { id: 'none', label: 'No aliases' },
                    ]}
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
                </TableToolbar>
                {skills.isPending ? (
                  <div aria-hidden className="flex flex-col gap-3 p-6">
                    {Array.from({ length: 6 }, (_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : skills.isError ? (
                  <StateView
                    tone="danger"
                    title="Couldn’t load the skills"
                    actionLabel="Try again"
                    onAction={() => void skills.refetch()}
                  />
                ) : rows.length === 0 ? (
                  <CardEmpty
                    title={deferred || filter !== 'all' ? 'No skills match' : 'No skills here'}
                    message={
                      page > 1
                        ? 'This page has no skills.'
                        : deferred
                          ? 'Try another skill or alias.'
                          : category
                            ? 'Add a skill to this category.'
                            : 'Add a category to start the taxonomy.'
                    }
                  />
                ) : (
                  <SkillsTable
                    rows={rows}
                    sort={sort}
                    onSort={() => reset(() => setSort((d) => (d === 'desc' ? 'asc' : 'desc')))}
                  />
                )}
                {skills.data && skills.data.total > 0 && (
                  <Pager page={page} pages={pages} onPage={setPage} />
                )}
              </AdminCard>
              {data && <MergesCard merges={data.merges} total={data.merges.length} />}
            </div>
          </div>
        </>
      )}
      {data && (
        <AddSkillDialog
          open={adding}
          onOpenChange={setAdding}
          categories={data.categories}
          categoryId={categoryId}
        />
      )}
    </AdminPage>
  );
}
