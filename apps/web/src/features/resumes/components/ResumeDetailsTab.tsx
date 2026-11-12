import { ATS_BAND_LABEL, atsBandFor, type Resume } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';

import { jobHref } from '@/features/jobs/jobHref';
import { formatCoarseAge, formatShortDate } from '@/lib/format';
import { DetailRow } from '@/ui/DetailRow';
import { BriefcaseIcon, CalendarIcon, ClockIcon, PdfIcon } from '@/ui/icons';
import { Building07, Check, CheckCircle, File06 } from '@/ui/lineIcons';
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
        <DetailRow icon={<CheckCircle className="size-4" />} label="Status">
          <Tag tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Tag>
        </DetailRow>
      )}
      {resume.targetRole && (
        <DetailRow icon={<BriefcaseIcon className="size-4" />} label="Target role">
          {resume.targetRole}
        </DetailRow>
      )}
      {resume.targetCompany && (
        <DetailRow icon={<Building07 className="size-4" />} label="Company">
          {resume.targetCompany}
        </DetailRow>
      )}
      <DetailRow icon={<CalendarIcon className="size-4" />} label="Created">
        {formatShortDate(resume.createdAt)}
      </DetailRow>
      <DetailRow icon={<ClockIcon className="size-4" />} label="Last updated">
        {`${formatShortDate(resume.updatedAt)} (${formatCoarseAge(resume.updatedAt).toLowerCase()})`}
      </DetailRow>
      <DetailRow icon={<ClockIcon className="size-4" />} label="Versions">
        {resume.versionCount}
      </DetailRow>
      {resume.pageCount != null && (
        <DetailRow icon={<PdfIcon className="size-4" />} label="Length">
          {pagesLabel(resume.pageCount)}
        </DetailRow>
      )}
      {/* Never a bare number (redesign R6a, audit RS-32; V2 §7.8): the band beside it, what it was
          measured against, and how it is scored. A total only against a job (D-15, RS-34), as on
          the Score tab. */}
      <DetailRow icon={<Check className="size-4" />} label="ATS score">
        {resume.atsScore != null && resume.linkedJobId ? (
          <>
            {resume.atsScore} · {ATS_BAND_LABEL[atsBandFor(resume.atsScore)]}, for this job ·{' '}
            <Link
              href={'/help' as Route}
              className="rounded-sm text-brand-600 transition-colors duration-press ease-standard hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              How it’s scored
            </Link>
          </>
        ) : (
          <>
            Not scored · a total needs a job ·{' '}
            <Link
              href={'/create/build' as Route}
              className="rounded-sm text-brand-600 transition-colors duration-press ease-standard hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Add a job
            </Link>
          </>
        )}
      </DetailRow>
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
