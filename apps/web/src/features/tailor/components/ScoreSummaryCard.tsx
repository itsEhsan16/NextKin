'use client';

import { atsBandFor, type JobMatch } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { cardSurface } from '@/ui/Card';
import { CheckCircle, InfoCircle, Lightbulb02 } from '@/ui/lineIcons';
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
 * The review's score card (toreview §121, from the owner's mockup): the ring, the band in words,
 * what it rests on — the job's key keywords the resume shows, and how the score moved — then one
 * plain next step. Every number is the run's own (G17). A plan score the run missed (toreview §129)
 * is still said, in a few words (owner, 2026-11-04: "too much unnecessary text").
 */
export function ScoreSummaryCard({
  score,
  baseline,
  projected,
  match,
  loading = false,
}: {
  score: number | undefined;
  /** The score is still being fetched; without it and not loading, the resume has none yet. */
  loading?: boolean;
  baseline: number | undefined;
  /** What the plan promised for these answers, out of 100. */
  projected?: number | undefined;
  match: JobMatch | undefined;
}) {
  if (score == null && loading) return <Skeleton className="h-28 shrink-0 rounded-lg" />;
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
  const moved =
    baseline == null
      ? null
      : score > baseline
        ? `Up from ${tenths(baseline)}`
        : score < baseline
          ? `Down from ${tenths(baseline)}`
          : 'Same as before';
  // A point of rounding either way is the same promise kept; a miss is said, briefly.
  const promise =
    projected != null && score < projected - 1 ? `Plan aimed for ${tenths(projected)}` : null;
  const missing = match?.missing ?? [];
  const tip =
    missing.length === 0
      ? 'All key keywords are in. Add results to stand out.'
      : `Missing: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ` +${missing.length - 3}` : ''}. Add only what’s true.`;
  return (
    // Compact: it is the one fixed block above the assistant, which takes the rest (toreview §122).
    <section
      aria-labelledby="review-score"
      className={cn(cardSurface, 'flex shrink-0 items-center gap-5 p-6')}
    >
      <ScoreRing
        score={score}
        label="Out of 10"
        name="ATS score"
        size={84}
        sweep
        outOf10
        showLabel
        tone={ringToneFor(band)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h2 id="review-score" className="text-h2 font-bold text-text-primary">
            {BAND_TITLE[band]}
          </h2>
          {match && (
            <span title={match.basis} className="text-text-tertiary">
              <InfoCircle aria-label={match.basis} className="size-4" />
            </span>
          )}
        </div>
        <p className="mt-1 text-body-m text-text-secondary">
          {[
            match ? `${match.matched} of ${match.total} key keywords` : 'Your score for this job',
            moved,
            promise,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p
          className={cn(
            'mt-3 flex items-start gap-2 rounded-md px-3 py-2.5 text-body-s font-medium',
            missing.length === 0
              ? 'bg-success-surface text-success-text'
              : 'bg-warning-50 text-warning-text',
          )}
        >
          {missing.length === 0 ? (
            <CheckCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          ) : (
            <Lightbulb02 aria-hidden className="mt-0.5 size-4 shrink-0" />
          )}
          {tip}
        </p>
      </div>
    </section>
  );
}
