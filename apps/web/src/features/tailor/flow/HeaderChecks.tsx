'use client';

import type { TailorComparison } from '@nextkin/shared/models';

import { SegmentedControl } from '@/ui/SegmentedControl';

import type { TailorChoices } from '../useTailorRun';
import { CategoryList, categoryRow } from './PlanExtras';

type Answer = 'keep' | 'remove' | 'replace';

const WHY: Record<NonNullable<TailorComparison['headerChecks']>[number]['kind'], string> = {
  relocation_elsewhere: 'This job is somewhere else.',
  other_role: 'This job is a different kind of role.',
};

/**
 * "Check your header" (owner, toreview §170): a line the user wrote about themselves that doesn't
 * fit this job, such as relocating to another city. Only the user decides what they are willing to
 * do, so each is asked: Keep, Remove, or Change to the line offered. Spec-derived (no board yet),
 * from the flow's own rows and the shared SegmentedControl.
 */
export function HeaderChecks({
  checks,
  choices,
}: {
  checks: TailorComparison['headerChecks'];
  choices: TailorChoices;
}) {
  if (!checks?.length) return null;
  return (
    <CategoryList
      title="Check your header"
      hint="Only you can decide this"
      label="Lines in your header to check"
    >
      {checks.map((check) => {
        const chosen = choices.headerChoiceOf(check.index);
        const value: Answer = chosen?.action ?? 'keep';
        const segments = [
          { id: 'keep' as const, label: 'Keep' },
          { id: 'remove' as const, label: 'Remove' },
          ...(check.suggestion ? [{ id: 'replace' as const, label: 'Change' }] : []),
        ];
        return (
          <li key={check.index} className={categoryRow}>
            <div className="min-w-0 flex-1 basis-60">
              <p className="text-body-l font-semibold text-text-primary">“{check.text}”</p>
              <p className="text-body-s font-medium text-text-tertiary">
                {WHY[check.kind]}
                {value === 'replace' && check.suggestion
                  ? ` It will read “${check.suggestion}”.`
                  : ''}
              </p>
            </div>
            <SegmentedControl
              label={`What to do with “${check.text}”`}
              segments={segments}
              value={value}
              onChange={(next) =>
                choices.setHeaderChoice(
                  check.index,
                  next === 'keep'
                    ? null
                    : next === 'remove'
                      ? { action: 'remove' }
                      : {
                          action: 'replace',
                          ...(check.suggestion ? { text: check.suggestion } : {}),
                        },
                )
              }
            />
          </li>
        );
      })}
    </CategoryList>
  );
}
