'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { useProgressFill, type ProgressPhase } from './useProgressFill';

export type { ProgressPhase } from './useProgressFill';

export type ProgressButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  phase: ProgressPhase;
  /** The resting label: "Continue" and its arrow. */
  children: ReactNode;
  /** What the work says as it goes, in order: "Reading the job…", "Analyzing…", "Almost there…". */
  stages: readonly string[];
  /** When each stage starts, in ms from the press; the first is 0. */
  stageAt?: readonly number[];
  /** Says this instead of the timed stages, for work the caller names itself ("Starting the check…"). */
  stage?: string;
  /** Called once the fill has reached the end after `done`, so the step moves on to a full pill. */
  onFilled?: () => void;
};

/**
 * A button that shows its work (owner, toreview §219). While a step's read runs it keeps its size,
 * walks through honest stage labels that cross-fade, and fills left to right with a soft gradient
 * whose leading edge sways like a liquid. Nothing reports a real percentage, so the fill eases on a
 * timer toward 90% and only runs to the end when the work resolves; on a failure it drains back.
 *
 * Presses are refused while it works (`aria-disabled`), without greying it out, and the stage is
 * announced politely. Reduced motion drops the edge and the sheen and steps the fill by stage.
 * Every frame of the creep is written straight to the fill's style, so React doesn't re-render
 * sixty times a second.
 */
export function ProgressButton({
  phase,
  children,
  stages,
  stageAt,
  stage,
  onFilled,
  className,
  onClick,
  type = 'button',
  ...rest
}: ProgressButtonProps) {
  const {
    fillRef: fill,
    stage: timed,
    busy,
  } = useProgressFill<HTMLSpanElement>({
    phase,
    stages,
    ...(stageAt ? { stageAt } : {}),
    ...(onFilled ? { onFilled } : {}),
  });

  const said = stage ?? timed;
  const labels = stage ? [stage] : stages;

  return (
    <>
      <button
        type={type}
        aria-busy={busy || undefined}
        aria-disabled={busy || rest.disabled || undefined}
        onClick={(event) => {
          if (busy) return event.preventDefault();
          onClick?.(event);
        }}
        className={cn(className, 'relative isolate overflow-hidden')}
        {...rest}
      >
        {/* The fill: a lighter brand tint over the brand pill, its surface swaying at the edge. */}
        <span
          aria-hidden
          ref={fill}
          data-testid="progress-fill"
          style={{ translate: '-100% 0' }}
          className="pointer-events-none absolute inset-0 z-behind bg-linear-to-r from-neutral-0/5 via-neutral-0/15 to-neutral-0/25"
        >
          {busy && (
            <>
              <span className="absolute inset-y-0 left-0 w-1/3 animate-sweep bg-linear-to-r from-transparent via-neutral-0/15 to-transparent motion-reduce:hidden" />
              <span className="absolute -right-2 -top-1/4 h-[150%] w-4 animate-liquid-edge rounded-full bg-neutral-0/30 blur-sm motion-reduce:hidden" />
            </>
          )}
        </span>

        {/* Every label in one cell: the button is as wide as the longest, and they cross-fade. */}
        <span className="inline-grid">
          <span
            aria-hidden={busy || undefined}
            className={cn(
              'col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-opacity duration-fast ease-standard',
              busy && 'opacity-0',
            )}
          >
            {children}
          </span>
          {labels.map((label) => (
            <span
              key={label}
              aria-hidden={!busy || label !== said || undefined}
              className={cn(
                'col-start-1 row-start-1 transition-opacity duration-fast ease-standard',
                (!busy || label !== said) && 'opacity-0',
              )}
            >
              {label}
            </span>
          ))}
        </span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {busy ? said : ''}
      </span>
    </>
  );
}
