'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { ThinkingOrb, type OrbState } from 'thinking-orbs';
import { MODE_FRAMES, paintFrame, resolvePreset } from 'thinking-orbs/engine';

import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

/** What the AI is doing; only the table below knows the animations (toreview §132.9). */
export type AiOrbState = 'working' | 'writing' | 'searching' | 'connecting' | 'shaping' | 'resting';

const ORB: Record<AiOrbState, OrbState> = {
  working: 'working',
  writing: 'composing',
  searching: 'searching',
  connecting: 'connecting',
  shaping: 'shaping',
  resting: 'breathing',
};

const SIZE = {
  sm: { box: 'size-5', px: 20 },
  md: { box: 'size-8', px: 32 },
  lg: { box: 'size-16', px: 64 },
  /*
   * The hero of a run screen, in place of its illustration (owner, toreview §132.9). The library
   * tunes only 20/32/64, so this is the 64 design, drawn by `SharpOrb` at full size (§232).
   */
  xl: { box: 'size-40', px: 64 },
} as const;

/** The CSS size of the `xl` box (`size-40`), which `SharpOrb` fills. */
const XL_PX = 160;

/**
 * The tuned 64px orb drawn sharp at a larger size (owner, toreview §232: the 64 canvas stretched
 * 2.5× by CSS was blurred). It uses the library's own engine, the same preset, frames and paint,
 * but on a canvas as large as the box (times the screen's pixel ratio) with the drawing scaled up,
 * so every dot is painted at its final size instead of being enlarged from a small bitmap. It
 * stops drawing while off screen or with the tab hidden, and holds a still frame when `paused`.
 */
function SharpOrb({ state, px, paused }: { state: OrbState; px: number; paused: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(px * dpr);
    canvas.height = Math.round(px * dpr);
    const { mode, speed, opts } = resolvePreset(state, 64);
    const frameAt = MODE_FRAMES[mode];
    const scale = (px / 64) * dpr;
    const draw = (seconds: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      paintFrame(ctx, frameAt(64, seconds, opts), false, TINT);
    };
    if (paused) {
      draw(0.6);
      return undefined;
    }
    let frame = 0;
    let visible = true;
    const loop = () => {
      draw((performance.now() / 1000) * speed);
      frame = requestAnimationFrame(loop);
    };
    const run = () => {
      cancelAnimationFrame(frame);
      if (visible && document.visibilityState !== 'hidden') frame = requestAnimationFrame(loop);
    };
    draw((performance.now() / 1000) * speed);
    const seen =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? true;
            run();
          });
    seen?.observe(canvas);
    document.addEventListener('visibilitychange', run);
    run();
    return () => {
      cancelAnimationFrame(frame);
      seen?.disconnect();
      document.removeEventListener('visibilitychange', run);
    };
  }, [state, px, paused]);
  return <canvas ref={ref} aria-hidden className="block size-full" />;
}

/** The brand ink as the engine's tint ({ r, g, b }). */
const TINT = (() => {
  const hex = colors.brand600.replace('#', '');
  const n = parseInt(hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
})();

const noop = () => () => undefined;
const REDUCED = '(prefers-reduced-motion: reduce)';

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia?.(REDUCED);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

/**
 * The AI at work, as a small animated orb of dots (owner, toreview §132.9) over `thinking-orbs`,
 * in the app's indigo. It is drawn on a canvas, so it mounts on the client only (the box holds its
 * place on the server). Under reduced motion it holds a still frame. Decorative by default: the
 * text beside it says what is happening.
 */
export function AiOrb({
  state = 'working',
  size = 'sm',
  label,
  className,
}: {
  state?: AiOrbState;
  size?: keyof typeof SIZE;
  /** An accessible name when nothing beside the orb says what it shows. */
  label?: string;
  className?: string;
}) {
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia?.(REDUCED).matches ?? false,
    () => false,
  );
  const preset = SIZE[size];
  return (
    <span
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      data-orb={state}
      className={cn('relative inline-block shrink-0', preset.box, className)}
    >
      {mounted && (
        <span key={state} className="absolute inset-0 animate-reveal">
          {size === 'xl' ? (
            <SharpOrb state={ORB[state]} px={XL_PX} paused={reduced} />
          ) : (
            <ThinkingOrb
              aria-hidden
              state={ORB[state]}
              size={preset.px}
              theme="light"
              color={colors.brand600}
              paused={reduced}
            />
          )}
        </span>
      )}
    </span>
  );
}
