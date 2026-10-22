import type { Resume } from '@nextkin/shared/models';
import type { ComponentType, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { LinkIcon, PdfIcon } from '@/ui/icons';
import { File06 } from '@/ui/lineIcons';

import { pagesLabel, STATE_LABEL, stateOf } from '../resumeLibrary';

type MetaItem = { key: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; label: string };

/**
 * "1 page · PDF · ATS Optimized · Tailored for Product Design roles" (304:3275), in the metadata
 * role `JobMetaRow` uses. PDF is the format Download produces. The board gives the last two the
 * same link glyph, and so does this.
 */
export function ResumeMetaRow({ resume, className }: { resume: Resume; className?: string }) {
  const state = stateOf(resume);
  const items: MetaItem[] = [
    ...(resume.pageCount != null
      ? [{ key: 'pages', Icon: File06, label: pagesLabel(resume.pageCount) }]
      : []),
    { key: 'format', Icon: PdfIcon, label: 'PDF' },
    ...(state ? [{ key: 'state', Icon: LinkIcon, label: STATE_LABEL[state] }] : []),
    ...(resume.description
      ? [{ key: 'description', Icon: LinkIcon, label: resume.description }]
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
        <span key={key} className="flex items-center gap-1.5 whitespace-nowrap">
          <Icon className="size-3.5 shrink-0" />
          {label}
        </span>
      ))}
    </div>
  );
}
