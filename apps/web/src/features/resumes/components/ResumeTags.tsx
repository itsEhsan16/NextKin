import type { Resume } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { Tag } from '@/ui/Tag';

import {
  STATE_HINT,
  STATE_LABEL,
  STATE_TONE,
  stateOf,
  VARIANT_HINT,
  VARIANT_LABEL,
  VARIANT_TONE,
} from '../resumeLibrary';

/** A row's two tags (304:3145): what kind of document, then what state it is in. */
export function ResumeTags({ resume, className }: { resume: Resume; className?: string }) {
  const state = stateOf(resume);
  if (!resume.variant && !state) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {resume.variant && (
        <span title={VARIANT_HINT[resume.variant]}>
          <Tag tone={VARIANT_TONE[resume.variant]}>{VARIANT_LABEL[resume.variant]}</Tag>
        </span>
      )}
      {state && (
        <span title={STATE_HINT[state]}>
          <Tag tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Tag>
        </span>
      )}
    </div>
  );
}
