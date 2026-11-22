'use client';

import { useRef } from 'react';

import { cn } from '@/lib/cn';

import { useSceneLoop, useSceneOnce } from '../../../motion/loop';
import { AnnotationTag } from '../../../parts/AnnotationTag';
import { Counter } from '../../../parts/Counter';
import { GlassCard, LightBeam } from '../../../parts/GlassCard';

/** Bar heights (527:745) out of the chart's 260px; index 5 is the current resume. */
const BARS = [48, 72, 132, 144, 60, 228, 125, 101, 168, 144];
const CURRENT = 5;

/**
 * The Match overview (527:738) as a dark glass panel (Landing v2). "18 of 21 required" ticks up,
 * the bars rise with the current resume's bar last, wearing a beam of light, and the Basis tag pins
 * itself to it. While on screen a faint scan passes over the chart and the current bar's spark
 * pulses. Rendered in its final state.
 */
export function MatchPanel() {
  const root = useRef<HTMLDivElement>(null);

  useSceneOnce(root, (tl, q) => {
    const bars = q('[data-bar]') as HTMLElement[];
    const others = bars.filter((_, i) => i !== CURRENT);
    tl.from(q('[data-glass-card]'), { y: 48, opacity: 0, duration: 1 })
      .from(
        others,
        { scaleY: 0, transformOrigin: '50% 100%', duration: 0.7, stagger: 0.06, ease: 'expo.out' },
        '-=0.55',
      )
      .from(
        bars[CURRENT]!,
        { scaleY: 0, transformOrigin: '50% 100%', duration: 1.1, ease: 'elastic.out(1, 0.6)' },
        '-=0.25',
      )
      .from(q('[data-bar-beam]'), { opacity: 0, duration: 0.8 }, '-=0.6')
      // The tag grows up out of the bar: pin, leader upward, then the pill drops onto it.
      .from(q('.lp-tag-pin'), { scale: 0, duration: 0.35, ease: 'back.out(3)' }, '-=0.4')
      .from(q('.lp-tag-leader'), {
        scaleY: 0,
        transformOrigin: '50% 100%',
        duration: 0.4,
        ease: 'power2.out',
      })
      .from(
        q('.lp-tag-label'),
        { y: 12, opacity: 0, scale: 0.92, duration: 0.55, ease: 'back.out(2)' },
        '-=0.15',
      );
  });

  useSceneLoop(
    root,
    (tl, q) => {
      tl.fromTo(
        q('[data-scan]'),
        { xPercent: -100, opacity: 1 },
        { xPercent: 620, opacity: 0, duration: 2.6, ease: 'sine.inOut' },
      ).fromTo(
        q('[data-spark-ring]'),
        { scale: 1, opacity: 0.9 },
        { scale: 3, opacity: 0, duration: 1.1, ease: 'power2.out' },
        0.4,
      );
    },
    { repeatDelay: 1.6, start: 'top 80%' },
  );

  return (
    <div ref={root} className="w-full shrink-0 lg:w-[640px]">
      <GlassCard
        dots
        beam={{ x: 80, y: 10, w: 45, h: 70, rotate: -30 }}
        className="rounded-[28px] sm:rounded-[36px]"
        visual={
          <div className="flex flex-col gap-4 px-5 py-6 sm:px-9 sm:py-8">
            <div className="flex items-center justify-between">
              <p className="text-[17px] font-medium text-lp-on-glass-dim sm:text-[19px]">
                Match overview
              </p>
              <span aria-hidden className="flex gap-1">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="size-1.5 rounded-full bg-lp-copy/50" />
                ))}
              </span>
            </div>
            <p className="text-[32px] font-semibold tracking-[-0.76px] text-lp-heading sm:text-[40px]">
              <Counter to={18} duration={1.8} delay={0.4} /> of 21{' '}
              <span className="font-normal text-lp-on-glass-dim">required</span>
            </p>
            {/* Headroom for the Basis tag above the tallest bar. */}
            <div className="h-11 sm:h-12" />
            <div className="relative flex h-[200px] items-end gap-2 sm:h-[260px] sm:gap-4">
              <span
                aria-hidden
                data-scan
                className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[16%] -translate-x-full opacity-0 bg-[linear-gradient(90deg,transparent,rgba(139,124,255,0.12),transparent)]"
              />
              <div className="flex h-[194px] w-6 shrink-0 flex-col justify-between text-[13px] text-lp-copy/70 sm:h-[252px]">
                <span>30</span>
                <span>20</span>
                <span>10</span>
                <span>0</span>
              </div>
              {BARS.map((h, i) => (
                <div
                  key={i}
                  data-bar
                  style={{ height: `${(h / 260) * 100}%` }}
                  className={cn(
                    'relative min-w-0 flex-1 rounded-t-[8px] rounded-b-[3px]',
                    i === CURRENT
                      ? 'bg-[linear-gradient(180deg,#c4b5fd_0%,#7c6cff_45%,#4a3ae8_100%)] shadow-[0_10px_26px_-6px_rgba(85,67,238,0.45)]'
                      : 'border border-lp-violet-line bg-[linear-gradient(180deg,rgba(196,181,253,0.55),rgba(239,237,255,0.6))]',
                  )}
                >
                  {i === CURRENT ? (
                    <>
                      <span
                        aria-hidden
                        data-bar-beam
                        className="pointer-events-none absolute -top-[55%] left-1/2 h-[120%] w-[340%] -translate-x-1/2"
                      >
                        <LightBeam beam={{ x: 50, y: 50, w: 60, h: 100, rotate: 0 }} />
                      </span>
                      <span aria-hidden className="absolute -top-1 left-1/2 -translate-x-1/2">
                        <span className="relative block size-2.5 rounded-full border-2 border-lp-white bg-lp-violet shadow-[0_0_10px_rgba(85,67,238,0.6)]">
                          <span
                            data-spark-ring
                            className="absolute inset-0 rounded-full border border-lp-violet opacity-0"
                          />
                        </span>
                      </span>
                      {/* The Basis tag stands above the bar, its pin on the bar's spark, so it never
                          reaches the card's edges (owner, 2026-11-22: it was clipped on the left). */}
                      <div
                        data-score-tag
                        className="absolute bottom-full left-1/2 z-[3] mb-[-6px] -translate-x-1/2"
                      >
                        <AnnotationTag
                          vertical
                          note={
                            <>
                              18 of 21 found<span className="hidden sm:inline"> on the page</span>
                            </>
                          }
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        }
      />
    </div>
  );
}
