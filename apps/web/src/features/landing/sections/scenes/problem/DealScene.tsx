'use client';

import { useRef } from 'react';

import { useSceneLoop } from '../../../motion/loop';

/**
 * The postings the one résumé goes out to: real job boards, the same logos the page uses where
 * it names the boards NextKin reads (owner, 2026-11-22). Each card says only "Sent"; the silence
 * shows in the total ("0 replies"), so no named company is shown as ignoring anyone.
 */
const JOBS = [
  { name: 'LinkedIn', logo: '/landing/logo-linkedin.svg' },
  { name: 'Indeed', logo: '/landing/integrations-indeed.svg' },
  { name: 'Naukri', logo: '/landing/logo-naukri-mark.svg' },
  { name: 'Glassdoor', logo: '/landing/integrations-glassdoor.svg' },
  { name: 'Wellfound', logo: '/landing/integrations-wellfound.svg' },
  { name: 'Greenhouse', logo: '/landing/integrations-greenhouse.svg' },
];

const SENT = 40;

function JobCard({ name, logo }: { name: string; logo: string }) {
  return (
    <div
      data-deal-job
      className="lp-glass-panel flex min-w-0 flex-col gap-1.5 rounded-[12px] px-2.5 py-2"
    >
      {/* Logo over name on narrow cards, so the longest name ("Greenhouse") always fits; side by
          side once the card has room. */}
      <span className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-1.5">
        <img src={logo} alt="" width={20} height={20} className="size-5 shrink-0 object-contain" />
        <span className="min-w-0 text-[11px] leading-tight font-semibold text-lp-on-glass sm:text-[11.5px]">
          {name}
        </span>
      </span>
      <span
        data-deal-tag
        className="flex w-fit items-center gap-1 rounded-full bg-lp-violet-soft px-1.5 py-px text-[9.5px] font-medium whitespace-nowrap text-lp-on-glass-dim"
      >
        <span className="size-1 rounded-full bg-lp-violet/60" />
        Sent
      </span>
    </div>
  );
}

/**
 * "One resume for every job" (rebuilt 2026-11-22): the same generic PDF goes out to six postings
 * and the total climbs to 40 sent · 0 replies. A 3×3 grid (three cards, the résumé across the
 * middle row, three cards) so nothing overlaps or truncates at any width.
 *
 * Loop, only while on screen: the résumé pulses, then a copy arcs out to each card in turn (x and
 * y on different eases make the curve); the card nudges as it lands and its "Sent" chip ticks in.
 * The flight offsets are functions of the live layout and the timeline re-measures them on every
 * repeat, so a resize never strands a copy. The markup is the final frame.
 */
export function DealScene() {
  const root = useRef<HTMLDivElement>(null);

  useSceneLoop(
    root,
    (tl, q) => {
      const ghosts = q('[data-deal-ghost]') as HTMLElement[];
      const jobs = q('[data-deal-job]') as HTMLElement[];
      const tags = q('[data-deal-tag]');
      const chip = q('[data-deal-chip]')[0] as HTMLElement;
      const sent = q('[data-deal-sent]')[0] as HTMLElement;
      const state = { n: 0 };
      // Offsets from the résumé's centre to a card's centre, read from layout (not transforms).
      const centre = (el: HTMLElement) => ({
        x: el.offsetLeft + el.offsetWidth / 2,
        y: el.offsetTop + el.offsetHeight / 2,
      });
      // The copies are parked on the scene's centre: start them on the résumé, fly to the card.
      const scene = () => ({ x: root.current!.offsetWidth / 2, y: root.current!.offsetHeight / 2 });
      const from = () => ({ x: centre(chip).x - scene().x, y: centre(chip).y - scene().y });
      const delta = (i: number) => {
        const to = centre(jobs[i]!);
        return { x: to.x - scene().x, y: to.y - scene().y };
      };

      tl.eventCallback('onRepeat', () => tl.invalidate());
      tl.set(tags, { opacity: 0, scale: 0.6 }, 0)
        .set(jobs, { opacity: 0.55 }, 0)
        .fromTo(
          chip,
          { scale: 0.94 },
          { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.55)' },
          0.1,
        );
      ghosts.forEach((ghost, i) => {
        const at = 0.55 + i * 0.16;
        const flight = 0.7;
        tl.set(ghost, { x: () => from().x, y: () => from().y, opacity: 1, scale: 1, rotate: 0 }, at)
          .to(ghost, { x: () => delta(i).x, duration: flight, ease: 'power2.inOut' }, at)
          .to(
            ghost,
            {
              y: () => delta(i).y,
              scale: 0.5,
              rotate: (i % 2 ? 1 : -1) * 10,
              duration: flight,
              ease: 'power3.inOut',
            },
            at,
          )
          .to(ghost, { opacity: 0, duration: 0.15 }, at + flight - 0.1)
          .fromTo(
            jobs[i]!,
            { opacity: 0.55, scale: 1 },
            { opacity: 1, scale: 1.04, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1 },
            at + flight - 0.05,
          )
          .to(jobs[i]!, { opacity: 1, duration: 0.01 }, at + flight + 0.35)
          .to(tags[i]!, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(3)' }, at + flight);
      });
      tl.fromTo(
        state,
        { n: 0 },
        {
          n: SENT,
          duration: 1.5,
          ease: 'power1.inOut',
          onUpdate: () => {
            sent.textContent = String(Math.round(state.n));
          },
        },
        0.55,
      );
    },
    { repeatDelay: 2.4 },
  );

  return (
    <div
      ref={root}
      className="relative mx-5 mt-5 grid grid-cols-3 grid-rows-[auto_1fr_auto] items-center gap-2 sm:mx-6 sm:gap-2.5"
    >
      {JOBS.slice(0, 3).map((job) => (
        <JobCard key={job.name} {...job} />
      ))}

      {/* The one generic résumé, across the middle row. */}
      <div className="col-span-3 flex justify-center py-2">
        <div
          data-deal-chip
          className="lp-glass-panel relative z-[1] flex flex-col items-center gap-2 rounded-[16px] px-4 py-3"
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
      </div>

      {JOBS.slice(3).map((job) => (
        <JobCard key={job.name} {...job} />
      ))}

      {/* Copies that fly out to each card (invisible at rest), parked on the résumé's centre. */}
      {JOBS.map((job) => (
        <span
          key={`ghost-${job.name}`}
          aria-hidden
          data-deal-ghost
          className="pointer-events-none absolute top-1/2 left-1/2 z-[2] -mt-[18px] -ml-[14px] flex h-9 w-7 items-end justify-center rounded-[5px] bg-[#ef4444] pb-1 text-[7px] font-bold text-lp-white opacity-0 shadow-[0_6px_14px_-4px_rgba(239,68,68,0.5)]"
        >
          PDF
        </span>
      ))}
    </div>
  );
}
