'use client';

import {
  atsBandFor,
  nextStepsLine,
  type JobMatch,
  type TailorNextStep,
} from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { cardSurface } from '@/ui/Card';
import { ArrowUp, CheckCircle, Lightbulb02 } from '@/ui/lineIcons';
import { ScoreRing, ringToneFor } from '@/ui/ScoreRing';
import { Skeleton } from '@/ui/Skeleton';

const BAND_TITLE = {
  strong: 'Strong match',
  good: 'Good match',
  fair: 'Fair match',
  weak: 'Weak match',
} as const;
const tenths = (score: number) => (score / 10).toFixed(1);

/**
 * The review's score card, simplified (owner, 2026-11-15): the ring, the band in words, and one
 * quiet line of what it rests on — how the score moved and how many of the job's key keywords
 * the resume shows. Under a hairline, one plain next step. No tinted boxes and no stray icons;
 * every number is the run's own (G17). A plan score the run missed (toreview §129) is still said.
 */
export function ScoreSummaryCard({
  score,
  baseline,
  projected,
  match,
  next,
  loading = false,
}: {
  score: number | undefined;
  /** The score is still being fetched; without it and not loading, the resume has none yet. */
  loading?: boolean;
  baseline: number | undefined;
  /** What the plan promised for these answers, out of 100. */
  projected?: number | undefined;
  match: JobMatch | undefined;
  /** What would raise the score further, priced on this version (toreview §206.3). */
  next?: readonly TailorNextStep[] | undefined;
}) {
  if (score == null && loading) return <Skeleton className="h-36 shrink-0 rounded-lg" />;
  if (score == null)
    return (
      <section className={cn(cardSurface, 'shrink-0 p-6')}>
        <h2 className="text-title-l font-bold text-text-primary">No ATS score yet</h2>
        <p className="mt-1 text-body-m text-text-secondary">
          It shows here once this resume has been measured against the job.
        </p>
      </section>
    );
  const band = atsBandFor(score);
  const up = baseline != null && score > baseline;
  const moved =
    baseline == null
      ? null
      : up
        ? `Up from ${tenths(baseline)}`
        : score < baseline
          ? `Down from ${tenths(baseline)}`
          : 'Same as before';
  // A point of rounding either way is the same promise kept; a miss is said, briefly.
  const promise =
    projected != null && score < projected - 1 ? `Plan aimed for ${tenths(projected)}` : null;
  const missing = match?.missing ?? [];
  // The run's own next steps, with what each adds, when it has them; else the keywords left.
  const tip =
    nextStepsLine(next) ??
    (missing.length === 0
      ? 'All key keywords are in. Add results to stand out.'
      : `Missing: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ` +${missing.length - 3}` : ''}. Add only what’s true.`);
  const done = missing.length === 0 && !next?.length;
  return (
    // Compact: it is the one fixed block above the assistant, which takes the rest (toreview §122).
    <section aria-labelledby="review-score" className={cn(cardSurface, 'shrink-0 overflow-hidden')}>
      <div className="flex items-center gap-5 px-6 py-5">
        <ScoreRing
          score={score}
          label="Out of 10"
          name="ATS score"
          size={76}
          sweep
          outOf10
          showLabel
          tone={ringToneFor(band)}
        />
        <div className="min-w-0 flex-1">
          <p className="text-caption-m font-semibold uppercase tracking-wide text-text-tertiary">
            ATS score
          </p>
          <h2 id="review-score" className="mt-0.5 text-h2 font-bold text-text-primary">
            {BAND_TITLE[band]}
          </h2>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-s font-medium text-text-secondary">
            {moved && (
              <span className={cn('flex items-center gap-1', up && 'text-success-text')}>
                {up && <ArrowUp aria-hidden className="size-3.5" />}
                {moved}
              </span>
            )}
            {match && (
              <span title={match.basis}>
                {match.matched} of {match.total} key keywords
              </span>
            )}
            {promise && <span>{promise}</span>}
          </p>
        </div>
      </div>
      <p className="flex items-start gap-2.5 border-t border-border-subtle px-6 py-3 text-body-s text-text-secondary">
        {done ? (
          <CheckCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-success-600" />
        ) : (
          <Lightbulb02 aria-hidden className="mt-0.5 size-4 shrink-0 text-text-tertiary" />
        )}
        <span className="min-w-0 break-words">{tip}</span>
      </p>
    </section>
  );
}
