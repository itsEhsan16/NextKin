'use client';

import type { Resume } from '@nextkin/shared/models';
import { useDuplicateResume } from '@nextkin/shared/queries';
import Link from 'next/link';
import { useState } from 'react';

import { DocTile, Radio, rowSurface } from '@/features/create/jobFlow/FlowRows';
import { resumeHref } from '@/features/resumes/resumeHref';
import { cn } from '@/lib/cn';
import { formatUpdated } from '@/lib/format';
import { showToast } from '@/lib/toast';
import { fieldBox } from '@/ui/fieldBox';
import { FilterCheckboxItem, FilterDropdown, MenuItem } from '@/ui/FilterDropdown';
import { EyeIcon, SearchIcon } from '@/ui/icons';
import { Briefcase01, Calendar, DotsVertical, SwitchVertical01 } from '@/ui/lineIcons';
import { Pager, pageOf } from '@/ui/Pager';
import { PillTabs } from '@/ui/PillTabs';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

const PAGE = 5;

type Tab = 'yours' | 'all';
type Sort = 'updated' | 'name';
const SORT_LABEL: Record<Sort, string> = { updated: 'Recently updated', name: 'Name A–Z' };

/** "Your resumes" are the ones you start from: not a copy already tailored for a job. */
const isYours = (resume: Resume) => resume.isBase || !resume.targetCompany;

const control =
  'flex h-10 items-center gap-2 rounded-lg border border-border-default bg-surface-card px-3.5 text-body-m font-medium text-text-primary transition-colors duration-press ease-standard hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

function StartingRow({ resume, on, onPick }: { resume: Resume; on: boolean; onPick: () => void }) {
  const duplicate = useDuplicateResume();
  return (
    <div className={cn(rowSurface(on), 'relative flex items-center gap-3.5 px-4 py-3')}>
      <button
        type="button"
        role="radio"
        aria-checked={on}
        aria-label={resume.title}
        onClick={onPick}
        className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      />
      <Radio on={on} />
      <DocTile />
      <span className="pointer-events-none min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-title-l font-bold text-text-primary">{resume.title}</span>
          {resume.isBase && (
            <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-caption-m font-semibold text-text-brand">
              Base resume
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-body-m text-text-tertiary">
          <span className="flex min-w-0 items-center gap-1.5">
            <Briefcase01 aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{resume.targetRole ?? 'General'}</span>
          </span>
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1.5">
            <Calendar aria-hidden className="size-3.5 shrink-0" />
            {formatUpdated(resume.updatedAt)}
          </span>
        </span>
      </span>
      <Link
        href={resumeHref(resume.id)}
        target="_blank"
        className="relative flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border-default bg-surface-card px-3.5 text-body-m font-semibold text-text-primary transition-colors duration-press ease-standard hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <EyeIcon aria-hidden className="size-3.5 text-text-tertiary" />
        Preview
      </Link>
      <span className="relative shrink-0">
        <FilterDropdown
          align="end"
          trigger={
            <button
              type="button"
              aria-label={`More for ${resume.title}`}
              className="flex size-9 items-center justify-center rounded-md text-text-tertiary transition-colors duration-press ease-standard hover:bg-surface-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <DotsVertical aria-hidden className="size-4" />
            </button>
          }
        >
          <MenuItem onSelect={() => window.open(resumeHref(resume.id), '_blank')}>
            Open in the editor
          </MenuItem>
          <MenuItem
            disabled={duplicate.isPending}
            onSelect={() =>
              duplicate.mutate(resume.id, {
                onSuccess: (copy) => showToast(`Made a copy: ${copy.title}`),
                onError: () => showToast('We couldn’t copy it. Try again.', { tone: 'error' }),
              })
            }
          >
            Make a copy
          </MenuItem>
        </FilterDropdown>
      </span>
    </div>
  );
}

/**
 * W-FLOW 02's resume list (849:318, redesigned in toreview §150): your resumes or all of them, a
 * search and a sort, five a page, each row with its role, when it changed, Preview and a menu.
 */
export function ResumePicker({
  resumes,
  loading,
  failed,
  onRetry,
  value,
  onPick,
}: {
  resumes: readonly Resume[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  value: string | undefined;
  onPick: (resumeId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('yours');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('updated');
  const [page, setPage] = useState(1);
  const yours = resumes.filter(isYours);
  const q = query.trim().toLowerCase();
  const listed = (tab === 'yours' ? yours : resumes)
    .filter((r) => !q || `${r.title} ${r.targetRole ?? ''}`.toLowerCase().includes(q))
    .slice()
    .sort((a, b) =>
      sort === 'name' ? a.title.localeCompare(b.title) : b.updatedAt.localeCompare(a.updatedAt),
    );
  const paged = pageOf(listed, page, PAGE);
  const reset = () => setPage(1);

  if (failed)
    return (
      <StateView
        tone="danger"
        title="Couldn't load your resumes"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={onRetry}
      />
    );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <PillTabs
          tabs={[
            { id: 'yours', label: 'Your resumes' },
            { id: 'all', label: 'All resumes' },
          ]}
          active={tab}
          {...(loading ? {} : { counts: { yours: yours.length, all: resumes.length } })}
          onChange={(next) => {
            setTab(next);
            reset();
          }}
          label="Which resumes"
        />
        <label
          className={cn(
            fieldBox,
            'ml-auto w-56 gap-2 px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600',
          )}
        >
          <SearchIcon aria-hidden className="size-3.5 shrink-0 text-text-tertiary" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              reset();
            }}
            placeholder="Search resumes…"
            aria-label="Search resumes"
            className="min-w-0 flex-1 bg-transparent text-body-m outline-none placeholder:text-text-tertiary"
          />
        </label>
        <FilterDropdown
          align="end"
          trigger={
            <button type="button" aria-label={`Sort: ${SORT_LABEL[sort]}`} className={control}>
              {SORT_LABEL[sort]}
              <SwitchVertical01 aria-hidden className="size-4 text-text-tertiary" />
            </button>
          }
        >
          {(Object.keys(SORT_LABEL) as Sort[]).map((key) => (
            <FilterCheckboxItem
              key={key}
              checked={sort === key}
              closeOnSelect
              onCheckedChange={() => setSort(key)}
            >
              {SORT_LABEL[key]}
            </FilterCheckboxItem>
          ))}
        </FilterDropdown>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3" aria-label="Loading your resumes">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div role="radiogroup" aria-label="Your resumes" className="flex flex-col gap-3">
            {paged.items.map((resume) => (
              <StartingRow
                key={resume.id}
                resume={resume}
                on={resume.id === value}
                onPick={() => onPick(resume.id)}
              />
            ))}
            {paged.items.length === 0 && (
              <p className="px-1 py-3 text-body-m text-text-tertiary">
                {q ? `No resume matches “${query.trim()}”.` : 'No resumes here yet.'}
              </p>
            )}
          </div>
          {listed.length > 0 && (
            <Pager
              page={paged.page}
              pages={paged.pages}
              onPage={setPage}
              shown={paged.items.length}
              total={listed.length}
              noun="resumes"
              variant="numbered"
              label="Resume pages"
            />
          )}
        </>
      )}
    </div>
  );
}
