import type { Resume } from '@nextkin/shared/models';
import Link from 'next/link';

import { jobHref } from '@/features/jobs/jobHref';
import { formatCoarseAge, formatShortDate } from '@/lib/format';
import { DetailRow } from '@/ui/DetailRow';
import { BriefcaseIcon, CalendarIcon, ClockIcon, IdCardIcon, LinkIcon, PdfIcon } from '@/ui/icons';
import { Check, File06 } from '@/ui/lineIcons';
import { Tag } from '@/ui/Tag';

import { pagesLabel, STATE_LABEL, STATE_TONE, stateOf, VARIANT_LABEL } from '../resumeLibrary';

/**
 * The Details tab, which the board names (304:3315) but never opens. It lists what the model holds
 * about the document, in the Applications card's label-and-value rows; a field the document has
 * no value for is left out rather than shown empty.
 */
export function ResumeDetailsTab({ resume }: { resume: Resume }) {
  const state = stateOf(resume);

  return (
    <dl className="flex flex-col gap-2">
      {resume.variant && (
        <DetailRow icon={<File06 className="size-4" />} label="Type">
          {VARIANT_LABEL[resume.variant]}
        </DetailRow>
      )}
      {state && (
        <DetailRow icon={<LinkIcon className="size-4" />} label="Status">
          <Tag tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Tag>
        </DetailRow>
      )}
      {resume.targetRole && (
        <DetailRow icon={<BriefcaseIcon className="size-4" />} label="Target role">
          {resume.targetRole}
        </DetailRow>
      )}
      <DetailRow icon={<CalendarIcon className="size-4" />} label="Created">
        {formatShortDate(resume.createdAt)}
      </DetailRow>
      <DetailRow icon={<ClockIcon className="size-4" />} label="Last updated">
        {`${formatShortDate(resume.updatedAt)} (${formatCoarseAge(resume.updatedAt).toLowerCase()})`}
      </DetailRow>
      <DetailRow icon={<IdCardIcon className="size-4" />} label="Versions">
        {resume.versionCount}
      </DetailRow>
      {resume.pageCount != null && (
        <DetailRow icon={<PdfIcon className="size-4" />} label="Length">
          {pagesLabel(resume.pageCount)}
        </DetailRow>
      )}
      {resume.atsScore != null && (
        <DetailRow icon={<Check className="size-4" />} label="ATS score">
          {resume.atsScore}
        </DetailRow>
      )}
      {resume.linkedJobId && (
        <DetailRow icon={<BriefcaseIcon className="size-4" />} label="Written for">
          <Link
            href={jobHref(resume.linkedJobId)}
            className="rounded-sm text-brand-600 transition-colors duration-press ease-standard hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            View the job
          </Link>
        </DetailRow>
      )}
    </dl>
  );
}
