'use client';

import { useRef, type CSSProperties } from 'react';

import { cn } from '@/lib/cn';

import { gsap, ScrollTrigger, useLandingMotion } from '../../../motion/gsap';
import { ClayTile, type ClayScene } from '../../../parts/ClayTile';

/** One grid cell in px, and the span of cells the lit squares can land on. */
const CELL = 56;
const COLS = 30;
const ROWS = 22;
const SQUARES = 28;

/** A small seeded random, so the server and the first client render place the squares alike. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const START = (() => {
  const rand = seeded(7);
  return Array.from({ length: SQUARES }, () => ({
    col: Math.floor(rand() * COLS),
    row: Math.floor(rand() * ROWS),
    // The resting frame (reduced motion) shows the squares at mixed strengths.
    opacity: Math.round((0.25 + rand() * 0.75) * 100) / 100,
  }));
})();

/**
 * The violet grid behind the CTA (owner, 2026-11-21: "implement this instead of those grid", after
 * an animated grid pattern reference): a flat violet ground, fine white lines skewed into a
 * receding plane, and single cells that light up softly, fade, and come back somewhere else.
 * Edges fade out under a radial mask. The squares only run while the card is on screen; with
 * reduced motion they stay as drawn.
 */
export function CtaGrid() {
  const root = useRef<HTMLDivElement>(null);
  useLandingMotion(root, () => {
    const el = root.current;
    if (!el) return;
    const rects = [...el.querySelectorAll<SVGRectElement>('[data-cta-square]')];
    const place = (r: SVGRectElement) => {
      r.setAttribute('x', String(Math.floor(Math.random() * COLS) * CELL + 1));
      r.setAttribute('y', String(Math.floor(Math.random() * ROWS) * CELL + 1));
    };
    const loops = rects.map((r) => {
      const hold = gsap.utils.random(0.4, 1.6);
      return gsap
        .timeline({
          repeat: -1,
          delay: gsap.utils.random(0, 4),
          repeatDelay: gsap.utils.random(0.4, 2.4),
          onRepeat: () => place(r),
          paused: true,
        })
        .fromTo(r, { opacity: 0 }, { opacity: 1, duration: 1.4, ease: 'sine.inOut' })
        .to(r, { opacity: 0, duration: 1.6, ease: 'sine.inOut' }, `+=${hold}`);
    });
    const run = ScrollTrigger.create({
      trigger: el,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => loops.forEach((t) => (self.isActive ? t.play() : t.pause())),
    });
    if (run.isActive) loops.forEach((t) => t.play());
  });

  const fade: CSSProperties = {
    maskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, #000 40%, rgba(0,0,0,0.35) 100%)',
    WebkitMaskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, #000 40%, rgba(0,0,0,0.35) 100%)',
  };
  return (
    <div ref={root} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* A flat violet ground, no gradient (owner, 2026-11-21). */}
      <div className="absolute inset-0 bg-lp-violet" />
      <div className="absolute inset-0" style={fade}>
        <svg
          className="absolute top-[-35%] left-[-5%] h-[170%] w-[110%] skew-y-12"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="lp-cta-grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
              <path
                d={`M${CELL} 0H0V${CELL}`}
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lp-cta-grid)" />
          {START.map((s, i) => (
            <rect
              key={i}
              data-cta-square
              x={s.col * CELL + 1}
              y={s.row * CELL + 1}
              width={CELL - 1}
              height={CELL - 1}
              fill="rgba(255,255,255,0.16)"
              opacity={s.opacity}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

/**
 * A clay toy lying on the grid: the scene tile plus a long soft shadow thrown to the bottom-right
 * (the window light comes from the top-left). `data-cta-clay` + `data-depth` let FinalCta drift it
 * with the pointer; the shadow moves with it, so nothing is repainted.
 */
export function CtaClay({
  scene,
  size,
  depth,
  className,
  style,
}: {
  scene: ClayScene;
  size: number;
  depth: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      data-cta-clay
      data-depth={depth}
      className={cn('pointer-events-auto absolute', className)}
      style={style}
    >
      <ClayTile scene={scene} size={size} />
    </div>
  );
}
