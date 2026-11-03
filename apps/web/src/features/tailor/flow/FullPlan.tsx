'use client';

import type { TailorComparison } from '@nextkin/shared/models';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { CollapseFade } from '@/ui/CollapseFade';
import { ChevronDownIcon } from '@/ui/icons';
import { textLink } from '@/ui/textLink';

import { PointsBar } from './PointsBar';

/**
 * Where the points go, folded away (owner, 2026-11-03, toreview §161). The plan's steps live in
 * Enhance itself now (keywords, "Show these in a role", real results, "More to raise your score"),
 * so only the bar of the score's parts stays behind a link.
 */
export function FullPlan({ comparison }: { comparison: TailorComparison }) {
  const [open, setOpen] = useState(false);
  const parts = comparison.plan?.parts ?? [];
  if (parts.length === 0) return null;
  return (
    <div className="border-t border-border-subtle">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(textLink, 'mx-8 my-4 flex items-center gap-1.5 text-body-m text-text-brand')}
      >
        {open ? 'Hide where your points go' : 'See where your points go'}
        <ChevronDownIcon
          aria-hidden
          className={cn(
            'size-3 transition-transform duration-press ease-standard',
            open && 'rotate-180',
          )}
        />
      </button>
      <CollapseFade axis="vertical" open={open}>
        <PointsBar parts={parts} />
      </CollapseFade>
    </div>
  );
}
