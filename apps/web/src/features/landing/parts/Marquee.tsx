'use client';

import { useRef, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { gsap, useLandingMotion } from '../motion/gsap';

/**
 * An endless horizontal strip. The children render twice; the track slides by exactly one copy
 * and loops, so the seam never shows (give the track a right padding equal to its gap). It drifts
 * at a constant speed and eases down to a crawl under the pointer. Deliberately not tied to scroll
 * velocity: that push made it lurch (2026-11-20). Under reduced motion it is a still, horizontally
 * scrollable row.
 */
export function Marquee({
  children,
  speed = 40,
  reverse = false,
  className,
  trackClassName,
}: {
  children: ReactNode;
  /** Pixels per second. */
  speed?: number;
  reverse?: boolean;
  className?: string;
  trackClassName?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  useLandingMotion(root, () => {
    const el = root.current;
    const track = el?.querySelector<HTMLElement>('[data-lp-track]');
    if (!el || !track) return;

    let loop: gsap.core.Tween | undefined;
    let hovering = false;
    const build = () => {
      const progress = loop?.progress() ?? 0;
      loop?.kill();
      const half = track.scrollWidth / 2;
      loop = gsap.fromTo(
        track,
        { x: reverse ? -half : 0 },
        {
          x: reverse ? 0 : -half,
          duration: half / speed,
          ease: 'none',
          repeat: -1,
          force3D: true,
        },
      );
      loop.progress(progress).timeScale(hovering ? 0.15 : 1);
    };
    build();

    const ease = (to: number) =>
      loop && gsap.to(loop, { timeScale: to, duration: 0.8, ease: 'power2.out', overwrite: true });
    const enter = () => {
      hovering = true;
      ease(0.15);
    };
    const leave = () => {
      hovering = false;
      ease(1);
    };
    // Card widths change at breakpoints; re-measure so the loop length always matches one copy.
    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 150);
    };
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(resizeTimer);
      loop?.kill();
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
      window.removeEventListener('resize', onResize);
    };
  });
  return (
    <div ref={root} className={cn('overflow-hidden motion-reduce:overflow-x-auto', className)}>
      <div data-lp-track className={cn('flex w-max will-change-transform', trackClassName)}>
        {children}
        <div aria-hidden className="contents">
          {children}
        </div>
      </div>
    </div>
  );
}
