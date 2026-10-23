'use client';

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type TransitionEvent,
} from 'react';

import { motion } from '@/theme/tokens';

/** How many cards show at once at the widest; the loop needs that many copies at its end. */
const SHOWN = 2;

const REDUCE = '(prefers-reduced-motion: reduce)';

/** The reader's reduced-motion setting, followed live: turning it on mid-visit stops the loop. */
function subscribeReducedMotion(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(REDUCE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const reducedMotionNow = () =>
  typeof window.matchMedia === 'function' && window.matchMedia(REDUCE).matches;

/**
 * Top Job Matches' loop. The track is the picks followed by copies of the first two, so stepping
 * past the last pick slides onto the copies — which look exactly like the start — and then, with
 * the transition off for one frame, jumps back to the real start. The reader only ever sees cards
 * arrive from the right.
 *
 * It advances by itself every `motion.delays.carousel` unless something holds it: a pointer over
 * it, focus inside it, a hidden tab, or a reader who asked for reduced motion.
 */
export function useJobCarousel(count: number) {
  const moves = count > SHOWN;
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [held, setHeld] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => false);

  const next = useCallback(() => {
    setAnimate(true);
    setIndex((current) => Math.min(current + 1, count));
  }, [count]);

  const previous = useCallback(() => {
    if (index > 0) {
      setAnimate(true);
      setIndex(index - 1);
      return;
    }
    // From the start, jump unseen onto the copies at the end, then slide back one.
    setAnimate(false);
    setIndex(count);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimate(true);
        setIndex(count - 1);
      }),
    );
  }, [count, index]);

  /** On the copies at the end: jump to the identical start without a transition. */
  const settle = useCallback(
    (event: TransitionEvent<HTMLElement>) => {
      // A card's own hover transition bubbles up here too; only the track's slide counts.
      if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
      if (index < count) return;
      setAnimate(false);
      setIndex(0);
    },
    [count, index],
  );

  // If the slide's `transitionend` never arrives (a tab hidden mid-slide), jump back anyway once
  // the slide would have finished, so the track never rests on the copies.
  useEffect(() => {
    if (!moves || index < count) return undefined;
    const timer = setTimeout(() => {
      setAnimate(false);
      setIndex(0);
    }, motion.durations.slide + 100);
    return () => clearTimeout(timer);
  }, [moves, index, count]);

  // The jump back is drawn with the transition off; turn it on again for the next step.
  useEffect(() => {
    if (animate) return undefined;
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, [animate]);

  useEffect(() => {
    if (!moves || held || reduced) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') next();
    }, motion.delays.carousel);
    return () => clearInterval(timer);
  }, [moves, held, reduced, next]);

  const order = moves
    ? [...Array.from({ length: count }, (_, i) => i), ...Array.from({ length: SHOWN }, (_, i) => i)]
    : Array.from({ length: count }, (_, i) => i);

  return {
    moves,
    // A shorter list after a refetch must not leave the track past its end.
    index: moves && index <= count ? index : 0,
    animate,
    order,
    next,
    previous,
    settle,
    holdProps: {
      onPointerEnter: () => setHeld(true),
      onPointerLeave: () => setHeld(false),
      onFocus: () => setHeld(true),
      onBlur: () => setHeld(false),
    },
  };
}
