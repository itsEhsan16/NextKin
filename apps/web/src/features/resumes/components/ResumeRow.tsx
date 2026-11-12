import type { Resume } from '@nextkin/shared/models';
import { useId } from 'react';

import { cn } from '@/lib/cn';
import { formatUpdated } from '@/lib/format';
import { cardSurface } from '@/ui/Card';
import { cardFaceHover, cardFaceMotion } from '@/ui/pressable';

import { STATE_LABEL, stateOf, VARIANT_LABEL } from '../resumeLibrary';
import { ResumeRowMenu } from './ResumeRowMenu';
import { ResumeTags } from './ResumeTags';
import { ResumeTile } from './ResumeTile';

export type ResumeRowProps = {
  resume: Resume;
  selected: boolean;
  onSelect: () => void;
  onDuplicated?: (id: string) => void;
};

/**
 * One document in the list (304:3126-3245): its tile, title and what it is for, when it last
 * changed, and its two tags. Built like `ApplicationRow`: the row selects through an invisible
 * full-cover button painted first, the content over it lets clicks through everywhere but the
 * kebab, and the selected row takes the lists' 2px indigo edge. A draft says what it still needs.
 */
export function ResumeRow({ resume, selected, onSelect, onDuplicated }: ResumeRowProps) {
  const state = stateOf(resume);
  const updated = formatUpdated(resume.updatedAt);
  const describedBy = useId();
  const description = [
    resume.variant && VARIANT_LABEL[resume.variant],
    state && STATE_LABEL[state],
    updated.toLowerCase(),
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <div className="group/card relative">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={resume.title}
        // What it is and when it changed, so a list of similar names stays apart (redesign R6a,
        // audit RS-13).
        aria-describedby={describedBy}
        className="peer absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      />

      <span id={describedBy} hidden>
        {description}
      </span>
      <div
        className={cn(
          cardSurface,
          'pointer-events-none relative flex items-start gap-4 px-5 py-4',
          cardFaceMotion,
          selected
            ? 'border-border-selected outline-1 -outline-offset-2 outline-border-selected'
            : cardFaceHover,
        )}
      >
        <ResumeTile accent={resume.accent} size="row" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            {/* Below 1280 the date moves under the title, which may then take two lines (RS-17). */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 xl:flex-row xl:items-start xl:gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-title-l font-semibold text-text-primary xl:line-clamp-1">
                  {resume.title}
                </h3>
                {resume.description && (
                  <p className="mt-0.5 truncate text-body-m text-text-secondary">
                    {resume.description}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-body-s text-text-tertiary xl:pt-0.5">{updated}</p>
            </div>
            {/* Drawn on every row (304:3141); its menu is spec-derived (toreview §124). */}
            <ResumeRowMenu resume={resume} {...(onDuplicated ? { onDuplicated } : {})} />
          </div>
          <ResumeTags resume={resume} className="mt-3" />
          {resume.draft && resume.docType === 'resume' && (
            <p className="mt-2 text-caption-m text-text-tertiary">
              Not ready to download yet: open it to finish.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
