'use client';

import type { Job, TailorComparison, TailorFix } from '@nextkin/shared/models';

import { Check } from '@/features/create/jobFlow/FlowRows';
import { cn } from '@/lib/cn';
import { ArrowUp, Stars02 } from '@/ui/lineIcons';

import type { TailorChoices } from '../useTailorRun';
import { FIX_ROWS } from '../tailorLibrary';
import { AtsMatchCard } from './AtsMatchCard';

/** "Aimed at Lead UX Designer", "Your latest 2 roles" (852:298-326): what each part will do. */
function partLine(
  fix: TailorFix,
  job: Job,
  choices: TailorChoices,
  comparison: TailorComparison,
): string {
  if (fix === 'headline') return `Aimed at ${job.title}`;
  if (fix === 'summary') return 'Rewritten for this role';
  if (fix === 'skills')
    return choices.added.length
      ? `The job’s skills first, plus the ${choices.added.length} you ticked`
      : 'The job’s skills first';
  if (fix === 'experience')
    return choices.experience === 'quick' ? 'Your latest 2 roles' : 'Every role';
  if (fix === 'projects') return 'Reworded in this job’s terms';
  const pages = comparison.pageCount;
  return pages && pages > 2 ? `${pages} pages down to 2` : 'Fit to one page, or two with 5+ years';
}

const card = 'rounded-xl border border-border-subtle bg-surface-card p-5 shadow-card';

/**
 * The right column of "Choose keywords" (owner's mockup, 2026-11-11): the score now and what the
 * user's ticks add (§166), the parts the AI will rewrite, each one switchable, and where the score
 * lands after this. Both numbers are the plan's own re-score (`projectedScore`, §129).
 */
export function EnhanceAside({
  job,
  comparison,
  choices,
  answersGain,
  base,
  projected,
}: {
  job: Job;
  comparison: TailorComparison;
  choices: TailorChoices;
  /** What the user's own answers add, out of 10. */
  answersGain: number;
  /** The score now, out of 10. */
  base: number | undefined;
  /** The score after the AI's steps and the user's answers, out of 10. */
  projected: number | undefined;
}) {
  const target = comparison.plan?.target;
  const goal = target?.goal;
  const gain = projected !== undefined && base !== undefined ? projected - base : 0;
  return (
    <aside
      className="grid min-w-0 content-start items-start gap-4 @3xl:grid-cols-2 @5xl:grid-cols-1"
      aria-label="What changes"
    >
      {comparison.scored !== false && (
        <AtsMatchCard score={comparison.score} gain={answersGain} selected={choices.added.length} />
      )}

      <section aria-labelledby="ai-will-change" className={card}>
        <h2
          id="ai-will-change"
          className="flex items-center gap-2.5 pb-3 text-title-l font-bold text-text-primary"
        >
          <Stars02 aria-hidden className="size-5 text-text-brand" />
          What the AI will change
        </h2>
        <ul className="-mx-2 flex flex-col">
          {FIX_ROWS.map((row) => {
            const on = choices.fixes.has(row.key);
            return (
              <li key={row.key}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => choices.toggleFix(row.key, !on)}
                  className="flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors duration-fast ease-standard hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
                >
                  <span className="pt-0.5">
                    <Check on={on} />
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block text-body-l font-semibold transition-colors duration-fast ease-standard',
                        on ? 'text-text-primary' : 'text-text-tertiary',
                      )}
                    >
                      {row.label === 'Work experience' ? 'Experience' : row.label}
                    </span>
                    <span className="block text-body-s font-medium text-text-tertiary">
                      {on ? partLine(row.key, job, choices, comparison) : 'Left as it is'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {projected !== undefined && base !== undefined && gain > 0 && (
        <div
          className="col-span-full flex items-start gap-3 rounded-xl bg-success-surface px-5 py-4"
          aria-live="polite"
        >
          <ArrowUp aria-hidden className="mt-0.5 size-5 shrink-0 text-success-600" />
          <div>
            <p className="text-title-l font-bold text-success-text">
              About {projected.toFixed(1)}/10 after this change
              {goal !== undefined && projected >= goal ? ` · ${goal.toFixed(1)} reached` : ''}
            </p>
            <p className="text-body-s font-medium text-success-text">
              Up from {base.toFixed(1)}. Ticks without a place count half.
              {goal !== undefined && target?.reaches && projected < goal
                ? ` The rest of the plan reaches ${goal.toFixed(1)}.`
                : ''}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
