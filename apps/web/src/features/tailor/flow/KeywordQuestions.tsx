'use client';

import type { KeywordQuestion } from '@nextkin/shared/models';
import { questionText } from '@nextkin/shared/tailor/questions';

import { SegmentedControl } from '@/ui/SegmentedControl';

import type { TailorChoices } from '../useTailorRun';
import { CategoryList, categoryRow } from './PlanExtras';

type Answer = 'no' | 'yes';

const SEGMENTS = [
  { id: 'no' as const, label: 'No' },
  { id: 'yes' as const, label: 'Yes' },
];

/** Whether a question has been answered yes: the keyword is confirmed at that place. */
export const saidYes = (choices: Pick<TailorChoices, 'places'>, q: KeywordQuestion): boolean =>
  choices.places[q.keyword]?.where.includes(q.where) ?? false;

/**
 * "Did you use these?" (owner, 2026-11-15; toreview §206.3): a keyword the job asks for, beside
 * the line of the user's own resume that hints they used it. Only the user knows, so each is
 * asked. "Yes" confirms it at that role as their own word; "No" is the default and adds nothing.
 * Spec-derived (no board yet), from the flow's own rows and the shared SegmentedControl, as
 * "Check your header" is.
 */
export function KeywordQuestions({
  questions,
  choices,
}: {
  questions: readonly KeywordQuestion[];
  choices: TailorChoices;
}) {
  if (questions.length === 0) return null;
  return (
    <CategoryList
      title="Did you use these?"
      hint="Only say yes if it’s true"
      label="Skills this job asks for that your resume may already hint at"
    >
      {questions.map((q) => {
        const value: Answer = saidYes(choices, q) ? 'yes' : 'no';
        return (
          <li key={`${q.keyword}@${q.where}`} className={categoryRow}>
            <div className="min-w-0 flex-1 basis-60">
              <p className="text-body-l font-semibold text-text-primary">{questionText(q)}</p>
              <p className="text-body-s font-medium text-text-tertiary">
                Your resume says: “{q.line}”
              </p>
            </div>
            <SegmentedControl
              label={questionText(q)}
              segments={SEGMENTS}
              value={value}
              onChange={(next) =>
                next === 'yes'
                  ? choices.togglePlace(q.keyword, q.where, true)
                  : choices.tick(q.keyword, false)
              }
            />
          </li>
        );
      })}
    </CategoryList>
  );
}
