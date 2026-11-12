'use client';

import { useSyncExternalStore } from 'react';
import { ThinkingOrb, type OrbState } from 'thinking-orbs';

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
   * draws only its tuned 20/32/64 (other sizes throw), so this is the 64 orb scaled up 2.5×.
   */
  xl: { box: 'size-40', px: 64 },
} as const;

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
        <span
          key={state}
          className={cn(
            'absolute inset-0 animate-reveal',
            size === 'xl' && 'flex origin-center scale-250 items-center justify-center',
          )}
        >
          <ThinkingOrb
            aria-hidden
            state={ORB[state]}
            size={preset.px}
            theme="light"
            color={colors.brand600}
            paused={reduced}
          />
        </span>
      )}
    </span>
  );
}
