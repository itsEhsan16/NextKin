import type { Job } from '@nextkin/shared/models';
import { EMPLOYMENT_TYPE_LABEL } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { HugeBriefcase, HugeLocation, HugeWorkHistory } from '@/ui/hugeIcons';

import { experienceLabel } from '../experienceRange';

export type JobMetaField = 'location' | 'type' | 'experience';

export type JobMetaRowProps = {
  job: Job;
  /** Which of the three to show, in this order. The Applications rows draw two (286:1324). */
  fields?: readonly JobMetaField[];
  className?: string;
};

const ALL_FIELDS: readonly JobMetaField[] = ['location', 'type', 'experience'];

/**
 * Location · employment type · experience, in the metadata role: the same row on the Jobs list
 * card (304:2464) and detail card (304:2696), and on the Applications rows (286:1324) and detail
 * card (286:1568).
 */
export function JobMetaRow({ job, fields = ALL_FIELDS, className }: JobMetaRowProps) {
  const items = (
    [
      { key: 'location', Icon: HugeLocation, label: job.location },
      { key: 'type', Icon: HugeBriefcase, label: EMPLOYMENT_TYPE_LABEL[job.employmentType] },
      { key: 'experience', Icon: HugeWorkHistory, label: experienceLabel(job) },
    ] as const
  ).filter((item) => fields.includes(item.key));

  return (
    <div className={cn('flex items-center gap-4 text-body-s text-text-tertiary', className)}>
      {items.map(({ key, Icon, label }) => (
        <span key={key} className="flex items-center gap-1.5 whitespace-nowrap">
          <Icon className="size-3.5 shrink-0" />
          {label}
        </span>
      ))}
    </div>
  );
}
