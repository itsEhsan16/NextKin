'use client';

import { useRef } from 'react';

import { useSceneLoop } from '../../../motion/loop';

/** Where the six job cards sit around the résumé, in % of the scene. */
const JOBS = [
  { left: 4, top: 6, name: 'Acme', tint: '#f97316' },
  { left: 37, top: 0, name: 'Northwind', tint: '#22c55e' },
  { left: 70, top: 6, name: 'Globex', tint: '#38bdf8' },
  { left: 2, top: 70, name: 'Initech', tint: '#e879f9' },
  { left: 37, top: 78, name: 'Umbrella', tint: '#facc15' },
  { left: 72, top: 70, name: 'Stark', tint: '#f43f5e' },
];

const SENT = 40;

/**
 * "One resume for every job": the same PDF deals itself out to six job posts, each comes back
 * "No reply", and the ticker counts 40 sent · 0 replies. Rendered on its final frame.
 */
export function DealScene() {
  const root = useRef<HTMLDivElement>(null);

  useSceneLoop(
    root,
    (tl, q) => {
      const ghosts = q('[data-deal-ghost]') as HTMLElement[];
      const jobs = q('[data-deal-job]') as HTMLElement[];
      const tags = q('[data-deal-tag]');
      const sent = q('[data-deal-sent]')[0] as HTMLElement;
      const state = { n: 0 };

      tl.set(tags, { opacity: 0, scale: 0.6 }, 0)
        .fromTo(
          jobs,
          { opacity: 0.25, scale: 0.94 },
          { opacity: 1, scale: 1, duration: 0.5, stagger: 0.06 },
          0,
        )
        .fromTo(
          q('[data-deal-chip]'),
          { scale: 0.92 },
          { scale: 1, duration: 0.5, ease: 'back.out(3)' },
          '<0.1',
        );
      ghosts.forEach((ghost, i) => {
        const job = jobs[i]!.getBoundingClientRect();
        const g = ghost.getBoundingClientRect();
        const dx = job.left + job.width / 2 - (g.left + g.width / 2);
        const dy = job.top + job.height / 2 - (g.top + g.height / 2);
        const at = 0.7 + i * 0.22;
        tl.fromTo(
          ghost,
          { x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 },
          {
            x: dx,
            y: dy,
            scale: 0.55,
            rotate: (i % 2 ? 1 : -1) * 12,
            duration: 0.55,
            ease: 'power2.inOut',
          },
          at,
        )
          .to(ghost, { opacity: 0, duration: 0.2 }, at + 0.5)
          .to(tags[i]!, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(3)' }, at + 0.6);
      });
      tl.fromTo(
        state,
        { n: 0 },
        {
          n: SENT,
          duration: 1.6,
          ease: 'power1.inOut',
          onUpdate: () => {
            sent.textContent = String(Math.round(state.n));
          },
        },
        0.7,
      );
    },
    { repeatDelay: 2.2 },
  );

  return (
    <div ref={root} className="relative mx-5 mt-5 h-[232px] sm:mx-6">
      {JOBS.map((job) => (
        <div
          key={job.name}
          data-deal-job
          className="lp-glass-panel absolute flex w-[28%] min-w-[92px] items-center gap-2 rounded-[12px] px-2.5 py-2"
          style={{ left: `${job.left}%`, top: `${job.top}%` }}
        >
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-lp-night"
            style={{ background: job.tint }}
          >
            {job.name[0]}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-[11px] font-semibold text-lp-on-glass">{job.name}</span>
            <span
              data-deal-tag
              className="w-fit rounded-full bg-lp-violet-soft px-1.5 py-px text-[9.5px] font-medium whitespace-nowrap text-lp-on-glass-dim"
            >
              No reply
            </span>
          </span>
        </div>
      ))}

      {/* The one generic résumé, in the middle. */}
      <div
        data-deal-chip
        className="lp-glass-panel absolute top-1/2 left-1/2 flex w-[150px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-[16px] px-3 py-3"
      >
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-7 items-end justify-center rounded-[5px] bg-[#ef4444] pb-1 text-[8px] font-bold text-lp-white">
            PDF
          </span>
          <span className="flex flex-col">
            <span className="text-[12px] font-semibold text-lp-on-glass">Resume.pdf</span>
            <span className="text-[10px] text-lp-on-glass-dim">v1 · generic</span>
          </span>
        </span>
        <span className="rounded-full border border-lp-violet-line bg-lp-white px-2 py-0.5 text-[10.5px] font-medium whitespace-nowrap text-lp-on-glass-dim">
          <span data-deal-sent className="font-semibold text-lp-violet tabular-nums">
            {SENT}
          </span>{' '}
          sent · <span className="font-semibold text-[#e11d48]">0</span> replies
        </span>
      </div>

      {/* Copies that fly out to each job (invisible at rest). */}
      {JOBS.map((job) => (
        <span
          key={`ghost-${job.name}`}
          aria-hidden
          data-deal-ghost
          className="absolute top-1/2 left-1/2 flex h-9 w-7 -translate-x-1/2 -translate-y-1/2 items-end justify-center rounded-[5px] bg-[#ef4444] pb-1 text-[7px] font-bold text-lp-white opacity-0"
        >
          PDF
        </span>
      ))}
    </div>
  );
}
