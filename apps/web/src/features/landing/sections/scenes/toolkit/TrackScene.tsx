'use client';

import { useRef } from 'react';

import { cn } from '@/lib/cn';

import { useSceneLoop } from '../../../motion/loop';
import { offsetBetween, SceneCursor } from './shared';

/** Monthly bar heights in board pixels (528:865); August is the highlighted month. */
const MONTHS = [
  ['Jan', 24],
  ['Feb', 35],
  ['Mar', 48],
  ['Apr', 24],
  ['May', 40],
  ['Jun', 29],
  ['Jul', 51],
  ['Aug', 99],
  ['Sep', 48],
  ['Oct', 45],
  ['Nov', 51],
  ['Dec', 26],
] as const;

const TABS = ['Applied', 'Interviews', 'Offers'] as const;
/** Bars the cursor visits before it settles on August (the only month the board gives data for). */
const VISITS = [2, 4, 6, 7];

/**
 * Track scene: the Applications chart on a glass panel. The tabs light up in turn, then a cursor
 * glides across the bars — each brightens under it — and settles on August, where the board's
 * "9 applied" tooltip rises. No other month shows a number: the board has none.
 */
export function TrackScene() {
  const root = useRef<HTMLDivElement>(null);
  useSceneLoop(
    root,
    (tl, q) => {
      const tabs = q('[data-tab-on]');
      const cursor = q('[data-cursor]')[0];
      const anchor = q('[data-cursor-home]')[0];
      const bars = q('[data-bar-glow]');
      const tooltip = q('[data-tooltip]');

      // Tabs light in turn and return to Applied.
      tl.fromTo(tabs[0]!, { opacity: 1 }, { opacity: 0, duration: 0.3 }, 0)
        .fromTo(tabs[1]!, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0)
        .to(tabs[1]!, { opacity: 0, duration: 0.3 }, 0.8)
        .fromTo(tabs[2]!, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.8)
        .to(tabs[2]!, { opacity: 0, duration: 0.3 }, 1.6)
        .to(tabs[0]!, { opacity: 1, duration: 0.3 }, 1.6);

      if (!cursor || !anchor) return;
      tl.set(tooltip, { opacity: 0, y: 8 }, 0);
      // The cursor enters from the bottom left, then visits bars.
      tl.fromTo(cursor, { x: -140, y: 50, opacity: 0 }, { opacity: 1, duration: 0.3 }, 1.9);
      let at = 2.1;
      VISITS.forEach((index) => {
        const bar = bars[index];
        if (!bar) return;
        tl.to(
          cursor,
          {
            x: () => offsetBetween(anchor, bar).x,
            y: () => offsetBetween(anchor, bar).y,
            duration: 0.55,
            ease: 'power2.inOut',
          },
          at,
        ).fromTo(bar, { opacity: 0 }, { opacity: 1, duration: 0.2 }, at + 0.45);
        if (index !== 7) tl.to(bar, { opacity: 0, duration: 0.3 }, at + 0.85);
        at += 0.75;
      });
      tl.to(tooltip, { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(2)' }, at - 0.2)
        .to(cursor, { x: 0, y: 0, duration: 0.3 }, at - 0.2)
        // Hold, then clear the hover so the loop restarts cleanly.
        .to(bars[7]!, { opacity: 0, duration: 0.4 }, at + 2.6)
        .to(tooltip, { opacity: 0, y: 8, duration: 0.4 }, at + 2.6)
        .to(cursor, { opacity: 0, duration: 0.3 }, at + 2.6);
    },
    { repeatDelay: 0.4 },
  );

  return (
    <div
      ref={root}
      className="lp-glass-panel relative flex flex-col gap-4 rounded-[20px] p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[15px] font-medium text-lp-on-glass-dim sm:text-[16px]">
            Applications
          </span>
          <span className="text-[32px] leading-none font-semibold tracking-[-0.76px] text-lp-heading tabular-nums sm:text-[38px]">
            24
          </span>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-lp-violet-line bg-lp-white px-4 py-2 text-[14px] font-medium text-lp-on-glass">
          Yearly
          <svg aria-hidden viewBox="0 0 16 16" width={14} height={14} fill="none">
            <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
          </svg>
        </span>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {TABS.map((tab, i) => (
          <span
            key={tab}
            className="relative overflow-hidden rounded-[10px] border border-lp-violet-line bg-lp-white px-[18px] py-[9px] text-[14px] font-semibold text-lp-on-glass"
          >
            <span
              data-tab-on
              aria-hidden
              className={cn(
                'absolute inset-0 z-[1] flex items-center justify-center bg-[linear-gradient(158deg,#7266f7_0%,#5543ee_71%)] text-lp-white',
                i === 0 ? 'opacity-100' : 'opacity-0',
              )}
            >
              {/* A white copy of the label, so the lit tab reads white on violet. */}
              {tab}
            </span>
            <span className="relative">{tab}</span>
          </span>
        ))}
      </div>

      <div className="flex items-end gap-1.5 pt-16 sm:gap-3">
        <div className="hidden flex-col pb-[26px] sm:flex" aria-hidden>
          <div className="flex h-[150px] w-[22px] flex-col justify-between text-[12px] text-lp-on-glass-dim/70">
            <span>30</span>
            <span>20</span>
            <span>10</span>
            <span>0</span>
          </div>
        </div>
        {MONTHS.map(([month, height], i) => {
          const peak = month === 'Aug';
          return (
            <div key={month} className="relative flex min-w-0 flex-1 flex-col items-center gap-2">
              {peak ? (
                <>
                  <div
                    data-tooltip
                    className="absolute -top-14 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center rounded-[10px] border border-lp-violet-line bg-lp-white px-3 py-2 text-[12px] whitespace-nowrap shadow-[0_10px_24px_-6px_rgba(85,67,238,0.3)]"
                  >
                    <span className="font-medium text-lp-on-glass-dim">Aug 2026:</span>
                    <span className="font-semibold text-lp-heading">9 applied</span>
                  </div>
                  {/* The cursor's final resting place: over the August bar. */}
                  <span
                    data-cursor-home
                    aria-hidden
                    className="absolute bottom-[22px] left-1/2 size-[22px]"
                  />
                  <SceneCursor className="bottom-[22px] left-1/2 hidden sm:block" />
                </>
              ) : null}
              <div className="relative w-full" style={{ height }}>
                <div
                  className={cn(
                    'absolute inset-0 rounded-[6px]',
                    peak
                      ? 'bg-[linear-gradient(180deg,#8b7cff,#4a3ae8)] shadow-[0_6px_16px_-4px_rgba(85,67,238,0.45)]'
                      : 'bg-[linear-gradient(180deg,#e4e0ff,#f2f0ff)]',
                  )}
                />
                {/* Hover glow, lit by the cursor. */}
                <div
                  data-bar-glow
                  data-index={i}
                  className={cn(
                    'absolute inset-0 rounded-[6px] bg-[linear-gradient(180deg,#c4b5fd,#8b7cff)]',
                    peak ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </div>
              <span className="text-[10px] text-lp-on-glass-dim sm:text-[12px]">
                <span className="sm:hidden">{month[0]}</span>
                <span className="hidden sm:inline">{month}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
