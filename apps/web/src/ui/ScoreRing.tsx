import type { CSSProperties } from 'react';

import { cn } from '@/lib/cn';

export type ScoreRingProps = {
  score: number;
  label: string;
  size?: number;
  className?: string;
  /** After the number: the Account board's completion ring reads "80%" (307:3697). */
  suffix?: string;
  /** The label under the number. The completion ring has none; its card's title says it. */
  showLabel?: boolean;
  /**
   * Sweep up from empty as it mounts — pass `useReveal`'s answer, so a ring that arrives with its
   * data replacing a skeleton fills in, while one already cached when the page opened just shows
   * (`toreview.md` §85).
   */
  sweep?: boolean;
  /** The arc's colour; green unless a board draws the band (`toreview.md` §103). */
  tone?: 'success' | 'warning' | 'danger';
  /** Read the 0–100 score out of 10 with one decimal: the tailor flow's "7.0" (toreview §113). */
  outOf10?: boolean;
  /** The big ring W-FLOW 03 draws (850:215): a hero-size number and an uppercase label. */
  large?: boolean;
  /** What a screen reader names the score, when the visible label is only a unit ("Out of 10"). */
  name?: string;
};

/**
 * The score dial on Your Resume Progress (286:614), kept at the board's 78 through the compact
 * pass: the 11px "ATS Score" label sits below the ring's centre, where the circle narrows, and
 * already grazes the stroke at 72 (clipped outright at 64).
 *
 * The board labels it "ATS Score". V2 §7.8 says the UI must call this "NextKin Score" and link
 * the rubric — the same conflict `toreview.md` §1.5 records on mobile, now on a second platform.
 * Rule 7 says the artboard wins, so the caller passes the board's label and the conflict is
 * logged rather than silently resolved here.
 */
/** The arc's colour by band: the tailor flow draws a Good 72 in amber and a Strong 88 in green. */
const RING_TONE = {
  success: 'text-success-text',
  warning: 'text-warning-text',
  danger: 'text-danger-600',
} as const;

export function ScoreRing({
  score,
  label,
  size = 78,
  className,
  suffix,
  showLabel = true,
  sweep = false,
  tone = 'success',
  outOf10 = false,
  large = false,
  name,
}: ScoreRingProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const shown = outOf10 ? (clamped / 10).toFixed(1) : String(clamped);
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${name ?? label}: ${shown}${suffix ?? (outOf10 ? ' out of 10' : ' out of 100')}`}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-neutral-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          // Where the sweep starts: the whole arc hidden.
          style={{ '--ring-empty': circumference } as CSSProperties}
          className={cn(
            RING_TONE[tone],
            'transition-[stroke-dashoffset] duration-meter ease-decelerate',
            sweep && 'animate-ring-sweep',
          )}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span
          aria-hidden
          className={cn(large ? 'text-hero font-extrabold' : 'text-h1', 'text-text-primary')}
        >
          {shown}
          {suffix}
        </span>
        {showLabel && (
          <span
            aria-hidden
            className={cn(
              'text-micro text-text-tertiary',
              large && 'font-semibold uppercase tracking-wide',
            )}
          >
            {label}
          </span>
        )}
      </span>
    </div>
  );
}
