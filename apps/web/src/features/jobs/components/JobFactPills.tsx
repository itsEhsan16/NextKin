import { EMPLOYMENT_TYPE_LABEL, REMOTE_TYPE_LABEL, type Job } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { formatSalaryBand } from '@/lib/format';

import { experienceLabel } from '../experienceRange';

/**
 * The list card's facts as pills (719:19): where, how, what kind, how senior and what it pays.
 * The workplace pill is left out when the location already says it ("Remote", "Remote"), and the
 * salary when the listing has none. Upright, unlike the italic skill pills (`JobTagPills`).
 */
export function JobFactPills({ job, className }: { job: Job; className?: string }) {
  const workplace = REMOTE_TYPE_LABEL[job.remote];
  const facts = [
    job.location,
    workplace === job.location ? null : workplace,
    EMPLOYMENT_TYPE_LABEL[job.employmentType],
    experienceLabel(job),
    job.salary ? formatSalaryBand(job.salary) : null,
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {facts.map((fact) => (
        <li
          key={fact}
          className="whitespace-nowrap rounded-full bg-surface-muted px-2.5 py-1 text-caption-m font-medium text-text-secondary"
        >
          {fact}
        </li>
      ))}
    </ul>
  );
}
