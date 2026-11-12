import type { Resume } from '@nextkin/shared/models';
import Link from 'next/link';
import type { ComponentType, ReactNode, SVGProps } from 'react';

import { jobHref } from '@/features/jobs/jobHref';
import { cn } from '@/lib/cn';
import { PdfIcon } from '@/ui/icons';
import { CheckCircle, File06, Target04 } from '@/ui/lineIcons';

import { pagesLabel, STATE_LABEL, stateOf } from '../resumeLibrary';

type MetaItem = { key: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; label: ReactNode };

/**
 * "1 page · PDF · ATS Optimized · Tailored for Product Design roles" (304:3275), in the metadata
 * role `JobMetaRow` uses. PDF is the format Download produces. The board gave the state and the
 * description a link glyph though neither was a link (audit RS-23): the state takes a check, the
 * description a target, and the description is a real link to the job a tailored copy was
 * written for.
 */
export function ResumeMetaRow({ resume, className }: { resume: Resume; className?: string }) {
  const state = stateOf(resume);
  const items: MetaItem[] = [
    ...(resume.pageCount != null
      ? [{ key: 'pages', Icon: File06, label: pagesLabel(resume.pageCount) }]
      : []),
    { key: 'format', Icon: PdfIcon, label: 'PDF' },
    ...(state ? [{ key: 'state', Icon: CheckCircle, label: STATE_LABEL[state] }] : []),
    ...(resume.description
      ? [
          {
            key: 'description',
            Icon: Target04,
            label: resume.linkedJobId ? (
              <Link
                href={jobHref(resume.linkedJobId)}
                className="rounded-sm text-text-brand transition-opacity duration-press ease-standard hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                {resume.description}
              </Link>
            ) : (
              resume.description
            ),
          },
        ]
      : []),
  ];

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1 text-body-s text-text-tertiary',
        className,
      )}
    >
      {items.map(({ key, Icon, label }) => (
        <span key={key} className="flex min-w-0 items-center gap-1.5">
          <Icon aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
      ))}
    </div>
  );
}
