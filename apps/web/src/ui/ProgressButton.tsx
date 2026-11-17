'use client';

import {
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/cn';

/**
 * Where the work stands:
 * - `idle`: the button rests;
 * - `working`: the fill creeps toward 90% while the stages walk on;
 * - `done`: the fill runs to the end, then `onFilled` fires;
 * - `failed`: the fill drains back to empty.
 */
export type ProgressPhase = 'idle' | 'working' | 'done' | 'failed';

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

const DEFAULT_STAGE_AT = [0, 1500, 5000];
/** The fill's ceiling while the work has no real percentage: it never claims to have finished. */
const CEILING = 0.9;
/** How fast the fill creeps: about two thirds of the way to the ceiling after this long. */
const CREEP_MS = 2500;
/** Under reduced motion the fill steps by stage instead of flowing. */
const STEPS = [0.3, 0.6, 0.9];
/** Matches `duration-meter`, the run to the end and the drain; `onFilled` waits no longer. */
const SETTLE_MS = 800;
const SETTLE = 'translate var(--transition-duration-meter) var(--ease-decelerate)';

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  stageAt = DEFAULT_STAGE_AT,
  stage,
  onFilled,
  className,
  onClick,
  type = 'button',
  ...rest
}: ProgressButtonProps) {
  const fill = useRef<HTMLSpanElement>(null);
  const progress = useRef(0);
  const filledFor = useRef<() => void>(undefined);
  useLayoutEffect(() => {
    filledFor.current = onFilled;
  });
  const [stageIndex, setStageIndex] = useState(0);
  // A new run, or a drained one, starts from the first stage (set while rendering, not after).
  const [seenPhase, setSeenPhase] = useState(phase);
  if (seenPhase !== phase) {
    setSeenPhase(phase);
    if (phase === 'working' || phase === 'failed') setStageIndex(0);
  }

  const working = phase === 'working' || phase === 'done';
  const busy = working;

  const paint = (value: number, transition: string) => {
    progress.current = value;
    const node = fill.current;
    if (!node) return;
    node.style.transition = transition;
    node.style.translate = `${(value - 1) * 100}% 0`;
  };

  // Paints before the frame, so a phase change never shows one frame of the old fill.
  useLayoutEffect(() => {
    if (phase === 'working') {
      const reduced = prefersReduced();
      const start = performance.now();
      const from = progress.current;
      let frame = 0;
      let shown = 0;
      const tick = (now: number) => {
        const elapsed = now - start;
        let index = 0;
        stageAt.forEach((at, i) => {
          if (elapsed >= at && i < stages.length) index = i;
        });
        if (index !== shown) {
          shown = index;
          setStageIndex(index);
        }
        const target = reduced
          ? (STEPS[Math.min(index, STEPS.length - 1)] ?? CEILING)
          : from + (CEILING - from) * (1 - Math.exp(-elapsed / CREEP_MS));
        paint(Math.max(progress.current, target), 'none');
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }
    if (phase === 'done') {
      paint(1, SETTLE);
      const timer = window.setTimeout(() => filledFor.current?.(), SETTLE_MS);
      return () => window.clearTimeout(timer);
    }
    paint(0, progress.current > 0 ? SETTLE : 'none');
    return undefined;
    // `stages` and `stageAt` are read when the work starts; a new array mid-run doesn't restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const said = stage ?? stages[Math.min(stageIndex, stages.length - 1)] ?? '';
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
          className="pointer-events-none absolute inset-0 z-behind bg-linear-to-r from-white/5 via-white/15 to-white/25"
        >
          {busy && (
            <>
              <span className="absolute inset-y-0 left-0 w-1/3 animate-sweep bg-linear-to-r from-transparent via-white/15 to-transparent motion-reduce:hidden" />
              <span className="absolute -right-2 -top-1/4 h-[150%] w-4 animate-liquid-edge rounded-full bg-white/30 blur-sm motion-reduce:hidden" />
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
