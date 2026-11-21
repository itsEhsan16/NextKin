'use client';

import { useRef } from 'react';

import { cn } from '@/lib/cn';

import { useSceneLoop } from '../../../motion/loop';
import { countInto } from './shared';

/**
 * The two "Skills matched" heatmaps (528:725 / 528:786), row by row: 0 empty, 1 partial, 2 full.
 * Read cell for cell off the board.
 */
const BEFORE = ['000000', '000000', '000000', '000000', '000200', '000100', '101100', '222220'];
const AFTER = ['000000', '000100', '101101', '222202', '222222', '222222', '222222', '222222'];

const CELL = [
  'bg-lp-violet-soft',
  'bg-lp-beam/50',
  'bg-lp-violet shadow-[0_2px_8px_0_rgba(85,67,238,0.35)]',
] as const;

function Heatmap({ rows, label, value }: { rows: string[]; label: string; value: number }) {
  return (
    <div data-map className="flex max-w-[188px] min-w-0 flex-1 flex-col gap-1.5">
      <div className="relative">
        <div
          className="grid grid-cols-6 gap-1"
          role="img"
          aria-label={`${label}: ${value}% of the job's skills matched`}
        >
          {rows.flatMap((row, r) =>
            [...row].map((c, i) => {
              const level = Number(c) as 0 | 1 | 2;
              return (
                <span
                  key={`${r}-${i}`}
                  data-lit={level > 0 ? '' : undefined}
                  data-col={i}
                  className={cn('aspect-[28/22] rounded-[4px]', CELL[level])}
                />
              );
            }),
          )}
        </div>
        {/* The sweep: a soft vertical beam that passes left to right as the cells light. */}
        <span
          data-sweep
          aria-hidden
          className="pointer-events-none absolute -inset-y-2 left-0 w-8 -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,transparent,rgba(139,124,255,0.4),transparent)] opacity-0"
        />
      </div>
      <div className="h-2" aria-hidden />
      <span
        data-count
        className="text-[24px] font-semibold tracking-[-0.24px] text-lp-heading tabular-nums"
      >
        {value}%
      </span>
      <span className="text-[14px] text-lp-on-glass-dim">{label}</span>
    </div>
  );
}

/**
 * Graduates scene: inside a glass panel, a beam sweeps across each heatmap and the matched cells
 * light up column by column under it while the percentage counts up — Before, then After.
 */
export function SkillsScene() {
  const root = useRef<HTMLDivElement>(null);
  useSceneLoop(
    root,
    (tl, q) => {
      q('[data-map]').forEach((map, mi) => {
        const lit = Array.from(map.querySelectorAll<HTMLElement>('[data-lit]'));
        const sweep = map.querySelector('[data-sweep]');
        const grid = map.querySelector('[role="img"]') as HTMLElement | null;
        const value = mi === 0 ? 45 : 83;
        const count = countInto(map.querySelector('[data-count]') ?? undefined, '%');
        const at = mi * 1.1;
        tl.fromTo(
          lit,
          { opacity: 0.1, scale: 0.6 },
          {
            opacity: 1,
            scale: 1,
            duration: 0.35,
            ease: 'back.out(2)',
            stagger: (_i: number, el: HTMLElement) => Number(el.dataset.col) * 0.13,
          },
          at,
        )
          .fromTo(
            sweep,
            { x: 0, opacity: 0 },
            { x: () => grid?.clientWidth ?? 160, opacity: 1, duration: 0.85, ease: 'none' },
            at,
          )
          .to(sweep, { opacity: 0, duration: 0.25 }, at + 0.75)
          .fromTo(
            count.state,
            { n: 0 },
            { n: value, duration: 0.9, ease: 'power2.out', onUpdate: count.update },
            at,
          );
      });
      // Hold the lit maps, then dim back so the loop restarts without a jump.
      tl.to(
        q('[data-lit]'),
        { opacity: 0.1, scale: 0.6, duration: 0.5, ease: 'power2.in' },
        '+=2.4',
      );
    },
    { repeatDelay: 0.3 },
  );

  return (
    <div ref={root} className="lp-glass-panel flex flex-col gap-4 rounded-[20px] p-5 sm:p-6">
      <p className="text-[17px] font-semibold text-lp-heading">Skills matched</p>
      <div className="flex gap-6 sm:gap-9">
        <Heatmap rows={BEFORE} label="Before" value={45} />
        <Heatmap rows={AFTER} label="After" value={83} />
      </div>
    </div>
  );
}
