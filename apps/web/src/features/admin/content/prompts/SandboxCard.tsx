'use client';

import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useId, useState } from 'react';

import type { PromptDetail, SandboxRun, SandboxSample } from '@nextkin/shared/models';
import { useRunSandbox } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { AdminIcon } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';
import { FilterDropdown } from '@/ui/FilterDropdown';
import { Check } from '@/ui/lineIcons';
import { chevronTurn, menuTrigger, tickMotion } from '@/ui/menuMotion';

import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { errorMessage, formatCount, formatRunCost, formatSeconds, formatTime } from '../format';
import { ActionButton } from '../ui/ContentBits';

/**
 * The sandbox (Figma 407:3141): run the draft on a seeded resume and job and read what it would
 * write, with the run's tokens, cost and latency. Seeded data only; nothing is saved and no real
 * user is touched. A preview shows only for the samples it ran on. Not served by the backend
 * yet, so on the real API it says so.
 */
export function SandboxCard({ detail }: { detail: PromptDetail }) {
  const sandbox = detail.sandbox;
  return (
    <AdminCard
      icon="Terminal"
      title="Sandbox"
      trailing={
        <AdminBadge tone="neutral" icon={<AdminIcon name="Lock01" size="xs" />}>
          Seeded data only
        </AdminBadge>
      }
      bodyClassName="gap-4"
    >
      {sandbox && sandbox.resumes.length === 0 ? (
        <CardEmpty
          title="No seeded samples"
          message={`${detail.name} has no seeded resumes or jobs to run on yet.`}
        />
      ) : sandbox ? (
        <Body detail={detail} sandbox={sandbox} />
      ) : (
        <NotConnected what="the prompt sandbox" />
      )}
    </AdminCard>
  );
}

function Body({
  detail,
  sandbox,
}: {
  detail: PromptDetail;
  sandbox: NonNullable<PromptDetail['sandbox']>;
}) {
  const [resume, setResume] = useState(sandbox.resumes[0]?.id ?? '');
  const [job, setJob] = useState(sandbox.jobs[0]?.id ?? '');
  const run = useRunSandbox(detail.name);
  const latest: SandboxRun | null = run.data ?? sandbox.lastRun;
  const result = latest && latest.resumeId === resume && latest.jobId === job ? latest : null;
  const version = detail.draft?.version ?? detail.activeVersion;

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <SampleSelect
          label="Sample resume"
          options={sandbox.resumes}
          value={resume}
          onChange={setResume}
        />
        <SampleSelect label="Sample job" options={sandbox.jobs} value={job} onChange={setJob} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex flex-1 items-center gap-3 text-body-s text-text-secondary">
          <AdminIcon name="Lock01" size="sm" className="text-neutral-400" />
          Runs use seeded data only and never touch real users. Results are not saved.
        </p>
        <ActionButton
          variant="primary"
          icon="Play"
          busy={run.isPending}
          onClick={() =>
            run.mutate(
              { resumeId: resume, jobId: job },
              { onError: (error) => showToast(errorMessage(error), { tone: 'error' }) },
            )
          }
        >
          Run in sandbox
        </ActionButton>
      </div>

      {result ? (
        <section
          aria-label="Output preview"
          className="@container flex animate-reveal flex-col gap-4"
          aria-live="polite"
        >
          <div className="flex min-h-7 items-center gap-2">
            <h3 className="text-body-s font-semibold text-text-primary">Output preview</h3>
            <AdminBadge tone="success" dot>
              Ran {formatTime(result.ranAt)} · v{result.version}
              {detail.draft?.version === result.version ? ' draft' : ''}
            </AdminBadge>
            <span className="flex-1" />
            <span className="text-caption-m font-normal text-text-secondary">
              {result.bullets.length} of {result.total} bullets shown
            </span>
          </div>
          <ul className="flex flex-col gap-4">
            {result.bullets.map((bullet, index) => (
              <li key={index} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="flex h-full flex-col gap-1 rounded-admin-md border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-body-s">
                  <span className="text-caption-m font-medium text-text-tertiary">Before</span>
                  <p className="text-text-secondary">{bullet.before}</p>
                </div>
                <AdminIcon name="ArrowRight" className="text-neutral-400" />
                <div className="flex h-full flex-col gap-1 rounded-admin-md border border-brand-100 bg-surface-card px-3.5 py-3 text-body-s">
                  <span className="flex items-center gap-2 text-caption-m font-normal">
                    <span className="font-medium text-brand-700">After</span>
                    <span className="flex-1" />
                    <span className="text-text-tertiary">{bullet.keywords.join(' · ')}</span>
                  </span>
                  <p className="text-text-primary">{bullet.after}</p>
                </div>
              </li>
            ))}
          </ul>
          {/* Four across, as drawn; two by two where the column is too narrow for four. */}
          <dl className="grid grid-cols-2 rounded-admin-md border border-neutral-200 bg-neutral-50 @admin-xs:grid-cols-4">
            <RunStat icon="Terminal" label="Input tokens" value={formatCount(result.inputTokens)} />
            <RunStat icon="File06" label="Output tokens" value={formatCount(result.outputTokens)} />
            <RunStat icon="CurrencyDollar" label="Cost" value={formatRunCost(result.costUsd)} />
            <RunStat icon="Clock" label="Latency" value={formatSeconds(result.latencySeconds)} />
          </dl>
        </section>
      ) : (
        <p className="rounded-md border border-dashed border-neutral-200 px-4 py-6 text-center text-body-s text-text-secondary">
          Run v{version} on a sample to preview what it writes.
        </p>
      )}
    </>
  );
}

function RunStat({ icon, label, value }: { icon: AdminIconName; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap border-neutral-200 px-4 py-3 text-body-s even:border-l nth-[n+3]:border-t @admin-xs:not-first:border-l @admin-xs:nth-[n+3]:border-t-0">
      <AdminIcon name={icon} size="sm" className="text-neutral-400" />
      <dt className="flex-1 text-text-secondary">{label}</dt>
      <dd className="font-semibold tabular-nums text-text-primary">{value}</dd>
    </div>
  );
}

/** A seeded-sample picker drawn as the board's 44px field with a chevron (407:3141). */
function SampleSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SandboxSample[];
  value: string;
  onChange: (id: string) => void;
}) {
  const id = useId();
  const chosen = options.find((o) => o.id === value);
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-body-s font-medium text-neutral-700">
        {label}
      </span>
      <FilterDropdown
        trigger={
          <button
            type="button"
            aria-labelledby={id}
            aria-describedby={`${id}-value`}
            className={cn(
              'flex h-11 w-full items-center gap-2 rounded-sm border border-neutral-300 bg-surface-card px-3.5 text-left text-body-m text-text-primary shadow-xs transition-field duration-fast hover:bg-neutral-50 focus-visible:border-border-selected focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100',
              menuTrigger,
            )}
          >
            <span id={`${id}-value`} className="min-w-0 flex-1 truncate">
              {chosen?.label ?? 'Choose a sample'}
            </span>
            <AdminIcon name="ChevronDown" className={cn('text-neutral-500', chevronTurn)} />
          </button>
        }
      >
        {/* One sample is chosen, so the rows are radios (`menuitemradio`), not checkboxes. */}
        <Dropdown.RadioGroup value={value} onValueChange={onChange}>
          {options.map((option) => (
            <Dropdown.RadioItem
              key={option.id}
              value={option.id}
              className="group/item flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-body-m text-text-primary outline-none transition-colors duration-press ease-standard data-[highlighted]:bg-surface-muted"
            >
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-border-default bg-surface-card text-text-inverse transition-colors duration-press ease-standard group-data-[state=checked]/item:border-brand-600 group-data-[state=checked]/item:bg-brand-600">
                <Dropdown.ItemIndicator className={tickMotion}>
                  <Check aria-hidden className="size-3" />
                </Dropdown.ItemIndicator>
              </span>
              <span className="truncate">{option.label}</span>
            </Dropdown.RadioItem>
          ))}
        </Dropdown.RadioGroup>
      </FilterDropdown>
    </div>
  );
}
