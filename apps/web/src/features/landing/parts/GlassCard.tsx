'use client';

import { useRef, type CSSProperties, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { gsap, useLandingMotion } from '../motion/gsap';

export type Beam = {
  /** Centre of the beam, as % of the card. */
  x: number;
  y: number;
  /** Size, as % of the card width and height. */
  w?: number;
  h?: number;
  rotate?: number;
};

/** A soft breathing light streak (`.lp-light-beam`), positioned in % of its container. */
export function LightBeam({ beam, className }: { beam: Beam; className?: string }) {
  const { x, y, w = 38, h = 120, rotate = -24 } = beam;
  return (
    <span
      aria-hidden
      className={cn('lp-light-beam', className)}
      style={
        {
          left: `${x - w / 2}%`,
          top: `${y - h / 2}%`,
          width: `${w}%`,
          height: `${h}%`,
          '--lp-beam-rotate': `${rotate}deg`,
        } as CSSProperties
      }
    />
  );
}

/**
 * Landing v2's card (owner, 2026-11-20, after the owner's references; light tone since the
 * owner's "dark tone does not look good"): a frosted white-to-lavender glass surface with a detailed mini-UI scene on top, a light beam, film grain, an optional halftone of
 * dots, and the title + body bottom-left. A soft spotlight follows the pointer on desktop.
 */
export function GlassCard({
  visual,
  title,
  body,
  beam,
  dots = false,
  icon,
  className,
  visualClassName,
  titleClassName,
}: {
  visual?: ReactNode;
  title?: ReactNode;
  body?: ReactNode;
  beam?: Beam | Beam[];
  dots?: boolean;
  /** A small icon before the title (a 3D clay icon or a glyph). */
  icon?: ReactNode;
  className?: string;
  visualClassName?: string;
  titleClassName?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  useLandingMotion(root, ({ isDesktop }) => {
    const el = root.current;
    const spot = el?.querySelector<HTMLElement>('.lp-glass-spot');
    if (!el || !spot || !isDesktop) return;
    const xTo = gsap.quickTo(spot, 'x', { duration: 0.6, ease: 'power3' });
    const yTo = gsap.quickTo(spot, 'y', { duration: 0.6, ease: 'power3' });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      xTo(e.clientX - r.left);
      yTo(e.clientY - r.top);
    };
    el.addEventListener('pointermove', move);
    return () => el.removeEventListener('pointermove', move);
  });
  const beams = beam ? (Array.isArray(beam) ? beam : [beam]) : [];

  return (
    <div ref={root} data-glass-card className={cn('lp-glass flex flex-col', className)}>
      {dots ? <span aria-hidden className="lp-glass-dots" /> : null}
      {beams.map((b, i) => (
        <LightBeam key={i} beam={b} />
      ))}
      <span aria-hidden className="lp-glass-spot" />
      {visual ? <div className={cn('relative z-[2] flex-1', visualClassName)}>{visual}</div> : null}
      {title || body ? (
        <div className="relative z-[2] px-6 pt-2 pb-6 sm:px-7 sm:pb-7">
          {title ? (
            <h3
              className={cn(
                'flex items-center gap-2.5 text-[20px] leading-[28px] font-semibold tracking-[-0.3px] text-lp-heading sm:text-[22px]',
                titleClassName,
              )}
            >
              {icon}
              {title}
            </h3>
          ) : null}
          {body ? (
            <p className="mt-2 max-w-[460px] text-[15px] leading-[23px] text-lp-on-glass-dim">
              {body}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
