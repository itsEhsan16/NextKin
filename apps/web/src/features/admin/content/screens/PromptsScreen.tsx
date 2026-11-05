'use client';

import { useDeferredValue, useState } from 'react';

import { useAdminPrompts } from '@nextkin/shared/queries';

import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { AdminBadge, TrendBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty } from '../../ui/AdminCard';
import { AdminPage } from '../../ui/AdminPage';
import { TableToolbar } from '../../ui/AdminTable';
import { ButtonGroup } from '../../ui/ButtonGroup';
import { SearchField } from '../../ui/SearchField';
import { StatCard } from '../../ui/StatCard';
import { NewDraftDialog } from '../prompts/NewDraftDialog';
import { PromptsTable } from '../prompts/PromptsTable';
import { ActionButton, InfoAlert } from '../ui/ContentBits';

type Filter = 'all' | 'draft' | 'failing';

/**
 * AI prompts (Figma 406:662): one live prompt version per pipeline stage, the drafts waiting on an
 * eval, and how each stage is doing. A stage's page holds its versions, editor, sandbox and eval.
 */
export function PromptsScreen() {
  const prompts = useAdminPrompts();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const needle = useDeferredValue(query).trim().toLowerCase();
  const [creating, setCreating] = useState(false);

  const stages = prompts.data?.stages ?? [];
  const drafts = stages.filter((s) => s.draft);
  const failing = stages.filter((s) => s.lastEval && !s.lastEval.passed);
  const awaiting = stages.filter((s) => s.draft?.state === 'awaiting_eval');
  const shown = (filter === 'draft' ? drafts : filter === 'failing' ? failing : stages).filter(
    (s) => !needle || `${s.name} ${s.description}`.toLowerCase().includes(needle),
  );
  const loading = prompts.isPending;
  const data = prompts.data;

  return (
    <AdminPage
      title="AI prompts"
      subtitle="One active prompt version per pipeline stage. Drafts publish only after a passing eval. Every change is audited."
      actions={
        <ActionButton
          variant="primary"
          icon="Plus"
          onClick={() => setCreating(true)}
          disabled={!data || data.stages.length === 0}
        >
          New draft
        </ActionButton>
      }
    >
      {prompts.isError ? (
        <StateView
          tone="danger"
          title="Couldn’t load the prompts"
          actionLabel="Try again"
          onAction={() => void prompts.refetch()}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 @min-[1200px]/admin:grid-cols-5">
            <StatCard
              icon="GitBranch01"
              title="Pipeline stages"
              value={loading ? undefined : stages.length}
              caption={
                stages.length
                  ? `${stages[0]?.name} to ${stages[stages.length - 1]?.name}`
                  : 'no stages yet'
              }
            />
            <StatCard
              icon="CheckCircle"
              title="Active versions"
              value={loading ? undefined : stages.filter((s) => s.activeVersion > 0).length}
              caption="one live version per stage"
            />
            <StatCard
              icon="Hourglass01"
              title="Drafts awaiting eval"
              value={loading ? undefined : awaiting.length}
              caption={awaiting.length ? awaiting.map((s) => s.name).join(' · ') : 'none waiting'}
            />
            <StatCard
              icon="ClipboardCheck"
              title="Eval pass rate"
              value={
                loading
                  ? undefined
                  : data?.evalPassRate
                    ? `${Math.round(data.evalPassRate.rate * 100)}%`
                    : '—'
              }
              badge={
                data?.evalPassRate &&
                data.evalPassRate.deltaPercent !== null && (
                  <TrendBadge up={data.evalPassRate.deltaPercent >= 0}>
                    {Math.abs(data.evalPassRate.deltaPercent)}%
                  </TrendBadge>
                )
              }
              caption={data?.evalPassRate ? 'last 30 days, all stages' : 'not reported yet'}
            />
            <StatCard
              icon="CoinsStacked01"
              title="Cost per resume"
              value={
                loading
                  ? undefined
                  : data?.costPerResume
                    ? `$${data.costPerResume.usd.toFixed(3)}`
                    : '—'
              }
              caption={
                !data?.costPerResume
                  ? 'not reported yet'
                  : data.costPerResume.previousUsd === null
                    ? 'last 30 days, finished resume runs'
                    : `${data.costPerResume.usd <= data.costPerResume.previousUsd ? 'down' : 'up'} from $${data.costPerResume.previousUsd.toFixed(3)} in ${data.costPerResume.previousLabel ?? 'the 30 days before'}`
              }
            />
          </div>

          <AdminCard
            icon="Stars02"
            title="Pipeline stages"
            trailing={
              loading ? (
                <Skeleton as="span" className="inline-block h-6 w-[72px] rounded-full" />
              ) : (
                <AdminBadge tone="neutral">{stages.length} stages</AdminBadge>
              )
            }
            bodyClassName="p-0"
          >
            <TableToolbar>
              <ButtonGroup
                label="Show stages"
                size="md"
                value={filter}
                onChange={setFilter}
                options={(
                  [
                    { id: 'all', label: 'All', count: stages.length },
                    { id: 'draft', label: 'Has draft', count: drafts.length },
                    { id: 'failing', label: 'Failing eval', count: failing.length },
                  ] as const
                ).map((option) => ({
                  ...option,
                  // No counts until the stages arrive; the chosen one's is indigo (406:885).
                  count: loading ? undefined : option.count,
                  countTone: option.id === filter ? ('brand' as const) : ('neutral' as const),
                }))}
              />
              <span className="flex-1" />
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Search stages"
                className="w-[320px]"
              />
            </TableToolbar>
            {loading ? (
              <div aria-hidden className="flex flex-col gap-3 p-6">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : shown.length === 0 ? (
              <CardEmpty
                title={stages.length ? 'No stages match' : 'No pipeline stages yet'}
                message={
                  stages.length
                    ? 'Try another name, or show all stages.'
                    : 'Stages appear here once the pipeline registers its prompts.'
                }
              />
            ) : (
              <PromptsTable stages={shown} />
            )}
          </AdminCard>

          <InfoAlert title="How prompt changes ship">
            A draft moves draft → sandbox test → eval → publish. Publishing is blocked until the
            draft passes its eval threshold, and rolling back to any earlier version is instant.
            Every publish and rollback is written to the audit log.
          </InfoAlert>
        </>
      )}

      {data && <NewDraftDialog open={creating} onOpenChange={setCreating} stages={stages} />}
    </AdminPage>
  );
}
