'use client';

import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { useEffect } from 'react';

import { gsap, MOTION_OK, ScrollTrigger } from './gsap';

/**
 * Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger scrubs stay in lockstep.
 * Off under reduced motion. `anchors` makes the nav's in-page links glide too.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (!window.matchMedia(MOTION_OK).matches) return;
    const lenis = new Lenis({ lerp: 0.1, anchors: { offset: -96 } });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);
  return null;
}
