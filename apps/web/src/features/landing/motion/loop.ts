'use client';

import type { RefObject } from 'react';

import { gsap, useLandingMotion } from './gsap';

/**
 * A looping micro-scene that plays only while its card is on screen (paused when it scrolls away,
 * resumed when it comes back), so a page full of scenes costs nothing offscreen.
 *
 * `build` adds tweens to the timeline. Write them as `fromTo`/`from` that END on the markup's own
 * state: the markup is server-rendered as the final frame, which is what reduced motion and no-JS
 * visitors see. Never `once: true` here (the reload crash, toreview §250.1).
 */
export function useSceneLoop(
  scope: RefObject<HTMLElement | null>,
  build: (tl: gsap.core.Timeline, q: (selector: string) => Element[]) => void,
  { repeatDelay = 1.2, start = 'top 85%' }: { repeatDelay?: number; start?: string } = {},
) {
  useLandingMotion(scope, () => {
    const el = scope.current;
    if (!el) return;
    const q = gsap.utils.selector(el);
    const tl = gsap.timeline({
      repeat: -1,
      repeatDelay,
      defaults: { ease: 'power2.out' },
      scrollTrigger: {
        trigger: el,
        start,
        end: 'bottom top',
        toggleActions: 'play pause resume pause',
      },
    });
    build(tl, q);
  });
}

/** One pass on entry (no loop), for scenes that should settle and stay. */
export function useSceneOnce(
  scope: RefObject<HTMLElement | null>,
  build: (tl: gsap.core.Timeline, q: (selector: string) => Element[]) => void,
  { start = 'top 82%' }: { start?: string } = {},
) {
  useLandingMotion(scope, () => {
    const el = scope.current;
    if (!el) return;
    const q = gsap.utils.selector(el);
    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      scrollTrigger: { trigger: el, start, toggleActions: 'play none none none' },
    });
    build(tl, q);
  });
}
