import type { ApplicationWithJob } from '@nextkin/shared/models';
import { useResumes } from '@nextkin/shared/queries';
import Link from 'next/link';

import { resumeHref } from '@/features/resumes/resumeHref';

import { formatShortDate } from '@/lib/format';
import { DetailRow } from '@/ui/DetailRow';
import { Skeleton } from '@/ui/Skeleton';
import { CalendarIcon, IdCardIcon } from '@/ui/icons';

import type { ApplicationStage } from '../applicationStage';

export type ApplicationSubmissionTabProps = { row: ApplicationWithJob; stage: ApplicationStage };

/**
 * The Application tab (286:1587), which the board names but never opens. It shows what the model
 * actually holds about the submission: when it went in, which resume went with it, and the
 * interview date once there is one. Nothing is invented to fill it out.
 */
export function ApplicationSubmissionTab({ row, stage }: ApplicationSubmissionTabProps) {
  const { application } = row;
  const resumes = useResumes();
  const resume = application.resumeId
    ? resumes.data?.find((item) => item.id === application.resumeId)
    : undefined;

  return (
    <dl className="flex flex-col gap-3">
      <DetailRow icon={<CalendarIcon className="size-4" />} label="Applied on">
        {formatShortDate(application.appliedAt)}
      </DetailRow>
      <DetailRow icon={<IdCardIcon className="size-4" />} label="Resume sent">
        {resume ? (
          <Link
            href={resumeHref(resume.id)}
            className="rounded-sm text-brand-600 transition-colors duration-press ease-standard hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {resume.title}
          </Link>
        ) : application.resumeId && resumes.isPending ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          'Not recorded'
        )}
      </DetailRow>
      {stage === 'interview' && application.interviewAt && (
        <DetailRow icon={<CalendarIcon className="size-4" />} label="Interview">
          {formatShortDate(application.interviewAt)}
        </DetailRow>
      )}
    </dl>
  );
}
