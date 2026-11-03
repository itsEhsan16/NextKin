'use client';

import { ATS_BAND_LABEL, atsBandFor } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { InfoCircle } from '@/ui/lineIcons';
import { ScoreRing } from '@/ui/ScoreRing';

const RING = { strong: 'success', good: 'success', fair: 'warning', weak: 'danger' } as const;
const PILL = {
  strong: 'bg-success-surface text-success-text',
  good: 'bg-success-surface text-success-text',
  fair: 'bg-warning-50 text-warning-text',
  weak: 'bg-danger-50 text-danger-text',
} as const;

const BASIS =
  'How well this resume matches the job: its keywords shown in your roles, a timeline that adds up, complete sections, a layout an ATS can read, and measured results. NextKin’s own measure.';

/**
 * "ATS Match Score" on Enhance (owner's reference card, 2026-11-04, toreview §166): the score now,
 * its band, and what the ticks so far are estimated to add. The estimate is the plan's own re-score
 * of those answers (`projectedScore`), labelled as one.
 */
export function AtsMatchCard({
  score,
  gain,
  selected,
}: {
  /** Out of 100, as the comparison holds it. */
  score: number;
  /** What the answers so far add, out of 10; 0 when nothing is chosen. */
  gain: number;
  /** How many keywords are ticked. */
  selected: number;
}) {
  const band = atsBandFor(score);
  return (
    <section
      aria-labelledby="ats-match-score"
      className="flex w-full max-w-[22rem] shrink-0 flex-col gap-3 rounded-xl border border-border-subtle bg-surface-card p-5 shadow-card"
    >
      <h2
        id="ats-match-score"
        className="flex items-center gap-2 text-title-l font-bold text-text-primary"
      >
        ATS Match Score
        <span title={BASIS} className="text-text-tertiary">
          <InfoCircle aria-label={BASIS} className="size-4.5" />
        </span>
      </h2>
      <div className="flex items-center gap-5">
        <ScoreRing
          score={score}
          label="out of 10"
          name="ATS score"
          size={112}
          sweep
          outOf10
          showLabel
          tone={RING[band]}
        />
        <div className="flex min-w-0 flex-col items-start gap-2">
          <span className={cn('rounded-md px-3 py-1 text-body-m font-semibold', PILL[band])}>
            {ATS_BAND_LABEL[band]}
          </span>
          {gain > 0 ? (
            <div aria-live="polite">
              <p className="text-title-l font-bold text-success-600">
                +{gain.toFixed(1)} points (est.)
              </p>
              <p className="text-body-s text-text-tertiary">
                {selected > 0
                  ? `If you add ${selected} selected keyword${selected === 1 ? '' : 's'}`
                  : 'With your answers so far'}
              </p>
            </div>
          ) : (
            <p className="text-body-s text-text-tertiary">
              Tick the keywords you have to see what they add.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
