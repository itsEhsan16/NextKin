'use client';

import type { JdQuote } from '@nextkin/shared/models';
import { useId, useState } from 'react';

import { cn } from '@/lib/cn';
import { CollapseFade } from '@/ui/CollapseFade';

/**
 * "Source" (toreview §153): the posting's own words a fact was read from, opened in place. A fact
 * said more than once shows every place it was said, so the reader can see why it is there.
 */
export function SourceQuotes({ quotes, label }: { quotes: readonly JdQuote[]; label: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (quotes.length === 0) return null;
  return (
    <span className="contents">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${open ? 'Hide' : 'Show'} where the listing says ${label}`}
        onClick={() => setOpen((v) => !v)}
        className="rounded-sm text-caption-m font-medium text-text-brand underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {open ? 'Hide source' : 'Source'}
      </button>
      <CollapseFade axis="vertical" open={open} className="basis-full">
        <ul id={id} className="mt-1.5 flex flex-col gap-1">
          {quotes.map((q) => (
            <li
              key={`${q.start}-${q.end}`}
              className={cn(
                'border-l-2 border-border-brand-strong pl-2.5 text-body-s italic text-text-secondary',
              )}
            >
              “{q.text}”
            </li>
          ))}
        </ul>
      </CollapseFade>
    </span>
  );
}
