'use client';

import type { TailorComparison } from '@nextkin/shared/models';
import { useState } from 'react';

import { stepCard } from '@/features/create/jobFlow/FlowChrome';
import { cn } from '@/lib/cn';
import { CollapseFade } from '@/ui/CollapseFade';
import { ChevronDownIcon } from '@/ui/icons';
import { Target04 } from '@/ui/lineIcons';

import type { TailorChoices } from '../useTailorRun';
import { EXPERIENCE_DEPTH_LABEL } from '../tailorLibrary';
import { FullPlan } from './FullPlan';
import { HeaderChecks } from './HeaderChecks';
import { MoreFixes, ShowInRole } from './PlanExtras';
import { RealResults } from './RealResults';

/**
 * Everything past the keywords, folded into one card (owner, 2026-11-11): header checks, skills to
 * show in a role, lines to finish with a real result, the rest of the plan, how much history to
 * edit and where the points go. All of it still counts in the projection; it is only out of the
 * way until opened.
 */
export function MoreWays({
  comparison,
  choices,
}: {
  comparison: TailorComparison;
  choices: TailorChoices;
}) {
  const [open, setOpen] = useState(false);
  const steps = comparison.plan?.steps ?? [];
  const places = comparison.places ?? [];
  const openItems =
    (comparison.headerChecks?.length ?? 0) +
    steps.filter(
      (s) => (s.kind === 'evidence' && s.who === 'you') || (s.kind === 'number' && s.bullet),
    ).length;

  return (
    <section aria-labelledby="more-ways" className={stepCard}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="more-ways-body"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3.5 px-8 py-5 text-left transition-colors duration-fast ease-standard hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-text-brand">
          <Target04 aria-hidden className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span id="more-ways" className="block text-title-l font-bold text-text-primary">
            More ways to raise your score
          </span>
          <span className="block text-body-s font-medium text-text-tertiary">
            {openItems > 0
              ? `${openItems} thing${openItems === 1 ? '' : 's'} only you can answer, and the rest of your plan`
              : 'The rest of your plan, and how much of your history to edit'}
          </span>
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            'size-3.5 shrink-0 text-text-tertiary transition-transform duration-base ease-standard',
            open && 'rotate-180',
          )}
        />
      </button>
      <CollapseFade axis="vertical" open={open} inert={!open}>
        <div
          id="more-ways-body"
          className="flex flex-col gap-6 border-t border-border-subtle px-8 py-6"
        >
          <HeaderChecks checks={comparison.headerChecks} choices={choices} />
          <ShowInRole steps={steps} places={places} choices={choices} />
          <RealResults
            flat
            steps={steps}
            resumeId={comparison.resumeId}
            figureOf={(b) => choices.figureOf(b.roleId, b.index)}
            onFigure={(b, text) => choices.setFigure(b.roleId, b.index, text)}
          />
          <MoreFixes steps={steps} resumeId={comparison.resumeId} />
          <fieldset className="flex flex-col gap-2">
            <legend className="pb-2 text-body-l font-bold text-text-primary">
              How much of your work history to edit
            </legend>
            {(['quick', 'full'] as const).map((depth) => (
              <label
                key={depth}
                className="flex min-h-control-sm cursor-pointer items-center gap-2.5 text-body-m text-text-secondary"
              >
                <input
                  type="radio"
                  name="experience-depth"
                  checked={choices.experience === depth}
                  onChange={() => choices.setExperience(depth)}
                  className="size-4 accent-brand-600"
                />
                {EXPERIENCE_DEPTH_LABEL[depth]}
              </label>
            ))}
          </fieldset>
        </div>
        <FullPlan comparison={comparison} />
      </CollapseFade>
    </section>
  );
}
