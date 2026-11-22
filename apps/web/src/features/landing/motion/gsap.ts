'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import type { RefObject } from 'react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, DrawSVGPlugin);
}

export { gsap, ScrollTrigger, SplitText, useGSAP };

/** The media query every landing animation runs under; reduced motion keeps the final state. */
export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

/**
 * `useGSAP` scoped to a section, run only when the visitor allows motion. Everything is server-
 * rendered in its final state, so with reduced motion (or before JS) the page is simply still.
 * The callback gets `isDesktop` (≥1024px) for animations that only make sense on wide screens.
 */
export function useLandingMotion(
  scope: RefObject<HTMLElement | null>,
  setup: (ctx: { isDesktop: boolean }) => void | (() => void),
  dependencies: unknown[] = [],
) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        { motion: MOTION_OK, desktop: '(min-width: 1024px)' },
        (context) => {
          const { motion, desktop } = context.conditions as { motion: boolean; desktop: boolean };
          if (!motion) return;
          return setup({ isDesktop: desktop });
        },
        scope,
      );
      return () => mm.revert();
    },
    { scope, dependencies },
  );
}
