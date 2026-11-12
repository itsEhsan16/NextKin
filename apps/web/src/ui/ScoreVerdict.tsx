import { MATCH_BAND_LABEL } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { MatchSparkleIcon } from '@/ui/icons';
import { CheckCircle, XClose } from '@/ui/lineIcons';

import { buttonClass } from './Button';
import { ringToneFor, ScoreRing } from './ScoreRing';
import { SCORE_TONE, type ScoreBand } from './scoreTone';
import { SkeletonCircle, SkeletonLines } from './SkeletonShapes';
import { textLink } from './textLink';

/**
 * A score with what it means (redesign R3c, `doc/redesign/03-component-inventory.md`
 * ScoreVerdict): verdict, then reason, then action. Jobright's "97% STRONG MATCH" on every card is
 * the pattern this exists to refuse:
 * - A number never shows without its band word, and the colour is the band's, never a default.
 * - No job description, no total (D-15): the `no-jd` state draws no ring and no number.
 * - Not enough evidence (D-14) says so instead of guessing: `insufficient`.
 * - A job-match score and a resume score are different numbers, and `kind` says which.
 *
 * `badge` and `pill` are the job list's chips (they were `MatchBadge` and `MatchPill`); `panel` is
 * the full verdict for a detail page or a flow's result.
 */
export type ScoreReason = { kind: 'met' | 'partial' | 'missing'; label: string };

type Action = { label: string; href?: Route; onClick?: () => void };

export type ScoreVerdictProps = {
  variant: 'badge' | 'pill' | 'panel';
  /** Which number this is: a job match, or a resume scored against a job. */
  kind: 'match' | 'resume';
  state?: 'scored' | 'no-jd' | 'insufficient' | 'loading' | 'error';
  /** 0–100. */
  score?: number;
  band?: ScoreBand;
  reasons?: readonly ScoreReason[];
  action?: Action;
  /** What evidence is missing, for `insufficient`: "Add dates to 2 roles". */
  missingEvidence?: string;
  /** Where a job description is added from, for `no-jd`. */
  addJobHref?: Route;
  /** "How NextKin Score works" (V2 §7.8: every score display links the rubric). */
  rubricHref?: Route;
  onRetry?: () => void;
  /** Sweep the ring in as the score replaces its skeleton. */
  sweep?: boolean;
  className?: string;
};

const BAND_WORD: Record<ScoreBand, string> = MATCH_BAND_LABEL;
const KIND_NAME = { match: 'Job match', resume: 'NextKin Score' } as const;

export function ScoreVerdict(props: ScoreVerdictProps) {
  const { variant, state = 'scored', score, band } = props;

  if (variant === 'badge') {
    // "98% Match" (304:2491): nothing at all without a number and its band.
    if (state !== 'scored' || score == null || band == null) return null;
    const tone = SCORE_TONE[band];
    return (
      <span
        className={cn(
          'whitespace-nowrap rounded-sm px-2 py-0.5 text-caption-m font-bold leading-4',
          tone.surface,
          tone.text,
          props.className,
        )}
      >
        {Math.round(score)}% Match
        <span className="sr-only"> · {BAND_WORD[band]}</span>
      </span>
    );
  }

  if (variant === 'pill') {
    // "Strong match" (719:12): the band in words.
    if (state !== 'scored' || band == null) return null;
    const tone = SCORE_TONE[band];
    return (
      <span
        className={cn(
          'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-2.5 pr-3 text-caption-m font-semibold',
          tone.surface,
          tone.text,
          props.className,
        )}
      >
        <MatchSparkleIcon className="h-auto w-3.5 shrink-0" />
        {BAND_WORD[band]}
      </span>
    );
  }

  return <ScorePanel {...props} />;
}

function ScorePanel({
  kind,
  state = 'scored',
  score,
  band,
  reasons = [],
  action,
  missingEvidence,
  addJobHref,
  rubricHref,
  onRetry,
  sweep = false,
  className,
}: ScoreVerdictProps) {
  const name = KIND_NAME[kind];
  const frame = (body: ReactNode, labelId?: string) => (
    <div role="group" aria-labelledby={labelId} className={cn('flex items-start gap-4', className)}>
      {body}
    </div>
  );

  if (state === 'loading') {
    return frame(
      <>
        <SkeletonCircle className="size-19.5" />
        <div className="flex flex-1 flex-col gap-2 pt-2">
          <SkeletonLines widths={['w-1/3', 'w-2/3']} />
        </div>
      </>,
    );
  }

  if (state === 'error') {
    return frame(
      <p className="text-body-m text-text-secondary">
        Couldn&apos;t score this.{' '}
        {onRetry && (
          <button type="button" onClick={onRetry} className={textLink}>
            Try again
          </button>
        )}
      </p>,
    );
  }

  // No job description: no ring and no number (D-15). The dashed circle holds the ring's place.
  if (state === 'no-jd' || state === 'insufficient' || score == null || band == null) {
    const noJd = state !== 'insufficient';
    const id = `score-${kind}-empty`;
    return frame(
      <>
        <span
          aria-hidden
          className="size-19.5 shrink-0 rounded-full border-2 border-dashed border-border-default bg-score-none-surface"
        />
        <div className="min-w-0 pt-2">
          <p id={id} className="text-body-m font-semibold text-text-primary">
            {noJd ? 'Add a job to score' : 'Not enough evidence yet'}
          </p>
          <p className="mt-0.5 text-body-s text-score-none-text">
            {noJd
              ? `Your ${name} compares your resume to one job description.`
              : (missingEvidence ?? 'Add more to your resume to score it.')}
          </p>
          {noJd && addJobHref && (
            <Link href={addJobHref} className={cn(textLink, 'mt-2 inline-block text-body-s')}>
              Add a job
            </Link>
          )}
        </div>
      </>,
      id,
    );
  }

  const tone = SCORE_TONE[band];
  const word = BAND_WORD[band];
  const id = `score-${kind}-band`;
  return frame(
    <>
      <ScoreRing
        score={Math.round(score)}
        label={name}
        name={`${name}, ${word}`}
        tone={ringToneFor(band)}
        sweep={sweep}
      />
      <div className="min-w-0 flex-1">
        <span
          id={id}
          className={cn(
            'inline-block rounded-full px-2.5 py-0.5 text-caption-m font-semibold',
            tone.surface,
            tone.text,
          )}
        >
          {word}
        </span>
        {reasons.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {reasons.map((reason) => (
              <li
                key={reason.label}
                className="flex items-start gap-2 text-body-s text-text-secondary"
              >
                <ReasonIcon kind={reason.kind} />
                <span>
                  {reason.label}
                  <span className="sr-only">
                    {reason.kind === 'met'
                      ? ' (met)'
                      : reason.kind === 'partial'
                        ? ' (partly: listed, not shown in a dated role)'
                        : ' (missing)'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {action &&
            (action.href ? (
              <Link
                href={action.href}
                className={buttonClass({ variant: 'secondary', size: 'sm' })}
              >
                {action.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className={buttonClass({ variant: 'secondary', size: 'sm' })}
              >
                {action.label}
              </button>
            ))}
          {rubricHref && (
            <Link href={rubricHref} className={cn(textLink, 'text-body-s')}>
              How {name} works
            </Link>
          )}
        </div>
      </div>
    </>,
    id,
  );
}

/** Met, partly met (D-14's half credit), missing: an icon each, never colour alone. */
function ReasonIcon({ kind }: { kind: ScoreReason['kind'] }) {
  if (kind === 'met')
    return (
      <CheckCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-feedback-success-icon" />
    );
  if (kind === 'partial')
    return (
      <span
        aria-hidden
        className="mt-1 size-3.5 shrink-0 rounded-full border-2 border-current text-feedback-warning-icon half-fill"
      />
    );
  return <XClose aria-hidden className="mt-0.5 size-4 shrink-0 text-text-tertiary" />;
}
