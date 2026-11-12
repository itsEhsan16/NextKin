import type { ApplicationWithJob } from '@nextkin/shared/models';

import { JobMetaRow } from '@/features/jobs/components/JobMetaRow';
import { cn } from '@/lib/cn';
import { formatCoarseAge } from '@/lib/format';
import { CompanyLogo } from '@/ui/CompanyLogo';
import { iconButton } from '@/ui/iconButton';
import { MoreVerticalIcon } from '@/ui/icons';
import { cardFaceHover, cardFaceMotion } from '@/ui/pressable';

import { stageOf } from '../applicationStage';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';
import { Soon, soonControl } from '@/ui/Soon';

export type ApplicationRowProps = {
  row: ApplicationWithJob;
  selected: boolean;
  onSelect: () => void;
};

/**
 * One application in the list (286:1312-1521): logo, role and company, where and what kind, when
 * it went in, and where it stands. Built like `JobCard`: the row selects through an invisible
 * full-cover button painted first, and the content over it lets clicks through everywhere but its
 * one control of its own, the kebab. The selected row takes the Jobs list's selection treatment,
 * a 2px indigo edge with nothing inside moving.
 */
export function ApplicationRow({ row, selected, onSelect }: ApplicationRowProps) {
  const { application, job } = row;

  return (
    <div className="group/card relative">
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        // Location too: two applications can share a title and an employer (Linear, twice).
        aria-label={`${job.title} at ${job.company}, ${job.location}`}
        className="peer absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      />

      <div
        className={cn(
          'pointer-events-none relative flex items-center gap-4 rounded-lg border bg-surface-card py-4 pl-5 pr-3 shadow-card',
          cardFaceMotion,
          selected
            ? 'border-border-selected outline-1 -outline-offset-2 outline-border-selected'
            : cn('border-border-subtle', cardFaceHover),
        )}
      >
        <CompanyLogo company={job.company} logoUrl={job.companyLogoUrl} variant="tile" />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="truncate text-title-l font-semibold text-text-primary">{job.title}</h3>
          <p className="truncate text-body-m text-text-company">{job.company}</p>
          <JobMetaRow job={job} fields={['location', 'type']} className="pt-1" />
        </div>

        <p className="shrink-0 text-right text-body-s text-text-tertiary">
          <span className="block">Applied</span>
          <span className="block">{formatCoarseAge(application.appliedAt)}</span>
        </p>
        <ApplicationStatusBadge stage={stageOf(row)} />
        {/* Drawn on every row (286:1339) with no menu behind it on any board; inert, like the
            Jobs detail card's, until one is drawn. */}
        <Soon>
          <button
            aria-disabled="true"
            type="button"
            aria-label="More options"
            className={cn(
              iconButton,
              'pointer-events-auto text-text-tertiary hover:text-text-primary',
              soonControl,
            )}
          >
            <MoreVerticalIcon className="size-4" />
          </button>
        </Soon>
      </div>
    </div>
  );
}
