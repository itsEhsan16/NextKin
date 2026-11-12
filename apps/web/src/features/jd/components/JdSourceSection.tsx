'use client';

import { useId, useState } from 'react';

import { cn } from '@/lib/cn';
import { CollapseFade } from '@/ui/CollapseFade';
import { ChevronDownIcon } from '@/ui/icons';
import { JdArtDocumentSearchIllustration } from '@/ui/illustrations';
import { chevronTurn } from '@/ui/menuMotion';
import { pressable } from '@/ui/pressable';

import { JobSection } from '../../jobs/components/page/JobSections';

/**
 * "The full description" (toreview §110): the text the JD was read from, as the user gave it. V2
 * §7.5 keeps the original visible beside what was extracted, so the reading can be checked against
 * it. Closed by default on the page, open while the details are being edited.
 */
export function JdSourceSection({ text, open: initial = false }: { text: string; open?: boolean }) {
  const [open, setOpen] = useState(initial);
  const bodyId = useId();
  if (!text.trim()) return null;
  return (
    <JobSection
      id="jd-source"
      Art={JdArtDocumentSearchIllustration}
      title="The full description"
      aside={
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={open ? 'Hide the full description' : 'Show the full description'}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            pressable,
            'flex h-control-sm items-center gap-1.5 rounded-md px-2.5 text-body-s font-medium text-text-brand hover:bg-surface-brand',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
          )}
        >
          {open ? 'Hide' : 'Show'}
          <ChevronDownIcon
            aria-hidden
            className={cn('size-3.5', chevronTurn, open && 'rotate-180')}
          />
        </button>
      }
    >
      <CollapseFade axis="vertical" open={open}>
        <div
          id={bodyId}
          className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-md bg-neutral-50 p-4 text-body-s text-text-secondary"
        >
          {text}
        </div>
      </CollapseFade>
    </JobSection>
  );
}
