'use client';

import type { TailorComparison } from '@nextkin/shared/models';
import { planGoalLine } from '@nextkin/shared/tailor/customize';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { CollapseFade } from '@/ui/CollapseFade';
import { ChevronDownIcon } from '@/ui/icons';
import { textLink } from '@/ui/textLink';

import type { TailorChoices } from '../useTailorRun';
import { PlanTable, PointsBar } from './PlanTable';

/**
 * The whole plan, folded away (owner, 2026-11-02, toreview §149): where the points go and every step
 * to the target, as step 3 used to show them. Its ticks are the same ticks as the keywords above.
 */
export function FullPlan({
  comparison,
  choices,
  onToggle,
}: {
  comparison: TailorComparison;
  choices: TailorChoices;
  onToggle: (keyword: string, on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const plan = comparison.plan;
  if (!plan || (plan.steps.length === 0 && plan.parts.length === 0)) return null;
  return (
    <div className="border-t border-border-subtle">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(textLink, 'mx-8 my-4 flex items-center gap-1.5 text-body-m text-text-brand')}
      >
        {open ? 'Hide the full plan' : `See the full plan · ${planGoalLine(plan)}`}
        <ChevronDownIcon
          aria-hidden
          className={cn(
            'size-3 transition-transform duration-press ease-standard',
            open && 'rotate-180',
          )}
        />
      </button>
      <CollapseFade axis="vertical" open={open}>
        <PointsBar parts={plan.parts} />
        {plan.steps.length > 0 && (
          <PlanTable
            steps={plan.steps}
            target={plan.target}
            added={choices.added}
            places={comparison.places ?? []}
            placeOf={(keyword) => choices.places[keyword]}
            resumeId={comparison.resumeId}
            figureOf={(b) => choices.figureOf(b.roleId, b.index)}
            onToggle={onToggle}
            onPlace={choices.placeKeyword}
            onFigure={(b, text) => choices.setFigure(b.roleId, b.index, text)}
          />
        )}
      </CollapseFade>
    </div>
  );
}
