'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Where the work stands:
 * - `idle`: nothing runs;
 * - `working`: the fill creeps toward 90% while the stages walk on;
 * - `done`: the fill runs to the end, then `onFilled` fires;
 * - `failed`: the fill drains back to empty.
 */
export type ProgressPhase = 'idle' | 'working' | 'done' | 'failed';

/** When each of three stages starts, in ms from the start of the work. */
export const DEFAULT_STAGE_AT: readonly number[] = [0, 1500, 5000];
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
 * Honest progress for work that reports no percentage (toreview §219, §221): the fill eases on a
 * timer toward 90% (fast, then slower), runs to the end only when the work resolves, and drains
 * on a failure, while the stage labels walk on. Every frame is written straight to the fill's
 * `translate` through `fillRef`, so React doesn't re-render per frame. Reduced motion steps the
 * fill by stage. Shared by `ProgressButton` and the resume upload's drop zone, so both move alike.
 */
export function useProgressFill<T extends HTMLElement>({
  phase,
  stages,
  stageAt = DEFAULT_STAGE_AT,
  onFilled,
}: {
  phase: ProgressPhase;
  stages: readonly string[];
  stageAt?: readonly number[];
  onFilled?: () => void;
}) {
  const fillRef = useRef<T>(null);
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

  const paint = (value: number, transition: string) => {
    progress.current = value;
    const node = fillRef.current;
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

  return {
    fillRef,
    /** The stage to show now. */
    stage: stages[Math.min(stageIndex, stages.length - 1)] ?? '',
    /** Working or finishing: show the stages, refuse new work. */
    busy: phase === 'working' || phase === 'done',
  };
}
