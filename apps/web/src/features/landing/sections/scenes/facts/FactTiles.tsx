'use client';

import { motion } from 'motion/react';
import { useRef } from 'react';

import { cn } from '@/lib/cn';

import { useSceneOnce } from '../../../motion/loop';
import { ClayTile, type ClayScene } from '../../../parts/ClayTile';
import { GlassCard } from '../../../parts/GlassCard';

type Fact = {
  prefix?: string;
  digit: number;
  label: string;
  scene: ClayScene;
  featured?: boolean;
};

/** Stat tiles (528:666): four facts, each checkable in the app. */
const FACTS: Fact[] = [
  { prefix: '$', digit: 0, label: 'PDF export, no watermark', scene: 'document' },
  { digit: 0, label: 'Made-up skills', scene: 'shield', featured: true },
  { digit: 5, label: 'Checks in every score', scene: 'gear' },
  { digit: 3, label: 'Free tailored resumes a month', scene: 'gift' },
];

const REEL = Array.from({ length: 20 }, (_, i) => i % 10);

/**
 * One odometer wheel: 0–9 twice over, parked on its digit. It renders parked (the final frame);
 * the motion rolls it from 0 through a full turn to land there, so "0 made-up skills" spins all
 * the way round and comes back to 0.
 */
function Odometer({ digit }: { digit: number }) {
  return (
    <span className="relative inline-block h-[1.15em] overflow-hidden align-bottom" aria-hidden>
      <span
        data-reel
        data-digit={digit}
        className="flex flex-col"
        style={{ transform: `translateY(${-((10 + digit) / 20) * 100}%)` }}
      >
        {REEL.map((d, i) => (
          <span key={i} className="block h-[1.15em] leading-[1.15em]">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * The four facts as dark glass tiles (Landing v2), each with its 3D clay scene floating above the
 * number. The featured "0 made-up skills" tile carries the violet beam and a lit edge.
 *
 * Motion: tiles rise in a wave, the clay scenes drop in with a little bounce, and every number
 * rolls like an odometer. Hovering lifts a tile; the clay scene tilts toward the pointer.
 */
export function FactTiles() {
  const root = useRef<HTMLDivElement>(null);

  useSceneOnce(root, (tl, q) => {
    tl.from(q('[data-fact]'), {
      y: 56,
      opacity: 0,
      duration: 1,
      stagger: 0.1,
      ease: 'expo.out',
    }).from(
      q('[data-fact-clay]'),
      { y: -18, scale: 0.7, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'back.out(2.2)' },
      '-=0.85',
    );
    (q('[data-reel]') as HTMLElement[]).forEach((reel, i) => {
      const digit = Number(reel.dataset.digit);
      tl.fromTo(
        reel,
        // y: 0 drops the server-rendered parked offset, so yPercent alone drives the wheel.
        { y: 0, yPercent: 0 },
        { yPercent: -((10 + digit) / 20) * 100, duration: 1.8, ease: 'power4.out' },
        0.35 + i * 0.12,
      );
    });
  });

  return (
    <div ref={root} className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {FACTS.map((fact) => (
        <div key={fact.label} data-fact className="h-full">
          <motion.div
            whileHover={{ y: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            className="h-full"
          >
            <GlassCard
              dots={fact.featured}
              beam={fact.featured ? { x: 50, y: 0, w: 80, h: 80, rotate: 0 } : undefined}
              className={cn(
                'h-full min-h-[210px] rounded-[24px] lg:min-h-[248px]',
                fact.featured &&
                  'border-lp-beam/50 shadow-[0_24px_50px_-24px_rgba(85,67,238,0.45)]',
              )}
              visualClassName="flex"
              visual={
                <div className="flex w-full flex-col items-center justify-center gap-3 px-3 py-6 text-center">
                  <div data-fact-clay>
                    <ClayTile scene={fact.scene} size={68} />
                  </div>
                  <span className="mt-1 text-[32px] leading-none font-bold tracking-[-0.76px] text-lp-heading sm:text-[40px]">
                    <span className="sr-only">
                      {fact.prefix ?? ''}
                      {fact.digit}
                    </span>
                    {fact.prefix ? <span aria-hidden>{fact.prefix}</span> : null}
                    <Odometer digit={fact.digit} />
                  </span>
                  <span
                    className={cn(
                      'text-[14px] sm:text-[17px]',
                      fact.featured ? 'text-lp-on-glass' : 'text-lp-on-glass-dim',
                    )}
                  >
                    {fact.label}
                  </span>
                </div>
              }
            />
          </motion.div>
        </div>
      ))}
    </div>
  );
}
