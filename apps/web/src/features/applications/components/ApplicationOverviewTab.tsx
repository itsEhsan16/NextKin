import type { ApplicationWithJob, Job } from '@nextkin/shared/models';
import { EMPLOYMENT_TYPE_LABEL, REMOTE_TYPE_LABEL } from '@nextkin/shared/models';
import Link from 'next/link';

import { jobHref } from '@/features/jobs/jobHref';
import { formatCoarseAge, formatSalaryBand, formatShortDate } from '@/lib/format';
import { DetailRow } from '@/ui/DetailRow';
import {
  ArrowRightIcon,
  CalendarIcon,
  IdCardIcon,
  LocationOutlineIcon,
  PaymentsIcon,
} from '@/ui/icons';

import type { ApplicationStage } from '../applicationStage';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';

/** "Bengaluru, India (Hybrid)" (286:1624): the workplace in brackets, unless the place says it. */
function locationLabel(job: Job): string {
  const workplace = REMOTE_TYPE_LABEL[job.remote];
  return job.location.toLowerCase().includes(workplace.toLowerCase())
    ? job.location
    : `${job.location} (${workplace})`;
}

export type ApplicationOverviewTabProps = { row: ApplicationWithJob; stage: ApplicationStage };

/**
 * The Overview tab (286:1593-1648): the application's facts, then the listing's description with
 * a way through to the rest of the listing. A row the listing has no value for (a requisition id,
 * a salary) is left out rather than shown empty. The board gives "Job type" the calendar glyph
 * again, and so does this (`toreview.md` §17).
 */
export function ApplicationOverviewTab({ row, stage }: ApplicationOverviewTabProps) {
  const { application, job } = row;

  return (
    <>
      <dl className="flex flex-col gap-2">
        <DetailRow icon={<CalendarIcon className="size-4" />} label="Applied on">
          {`${formatShortDate(application.appliedAt)} (${formatCoarseAge(application.appliedAt)})`}
        </DetailRow>
        {job.reference && (
          <DetailRow icon={<IdCardIcon className="size-4" />} label="Job ID">
            {job.reference}
          </DetailRow>
        )}
        <DetailRow icon={<CalendarIcon className="size-4" />} label="Job type">
          {EMPLOYMENT_TYPE_LABEL[job.employmentType]}
        </DetailRow>
        <DetailRow icon={<LocationOutlineIcon className="size-4" />} label="Location">
          {locationLabel(job)}
        </DetailRow>
        {job.salary && (
          <DetailRow icon={<PaymentsIcon className="size-4" />} label="Salary range">
            {formatSalaryBand(job.salary)}
          </DetailRow>
        )}
        <DetailRow icon={<IdCardIcon className="size-4" />} label="Status">
          <ApplicationStatusBadge stage={stage} />
        </DetailRow>
      </dl>

      <h3 className="mt-5 text-title-l text-neutral-800">Job description</h3>
      <p className="mt-1.5 text-prose text-text-secondary">{job.description}</p>
      <Link
        href={jobHref(job.id)}
        className="mt-2 inline-flex items-center gap-2 rounded-sm text-body-l font-semibold text-brand-600 transition-colors duration-press ease-standard hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        View full job description
        <ArrowRightIcon className="size-4" />
      </Link>
    </>
  );
}
