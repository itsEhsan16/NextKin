'use client';

import { useRef, type ReactNode } from 'react';

import { gsap, useLandingMotion } from '../motion/gsap';
import { AccentWord } from '../parts/AccentWord';

const imgMark = (src: string) => (
  <img src={src} alt="" width={36} height={36} className="size-9 shrink-0" />
);

/**
 * The five board chips (525:619), in the board's order. LinkedIn and Naukri use the companies'
 * own logos (LinkedIn's from Wikimedia Commons, Naukri's from naukri.com), replacing the
 * board's drawn stand-ins.
 */
const BOARDS: { name: string; mark: ReactNode }[] = [
  { name: 'LinkedIn', mark: imgMark('/landing/logo-linkedin.svg') },
  { name: 'Indeed', mark: imgMark('/landing/boards-indeed.svg') },
  { name: 'Naukri', mark: imgMark('/landing/logo-naukri-mark.svg') },
  { name: 'Glassdoor', mark: imgMark('/landing/boards-glassdoor.svg') },
  { name: 'Wellfound', mark: imgMark('/landing/boards-wellfound.svg') },
];

function BoardChip({ name, mark }: { name: string; mark: ReactNode }) {
  return (
    <div
      data-board-chip
      className="flex h-16 w-[calc(50%-8px)] shrink-0 items-center justify-center gap-3.5 rounded-full border-[1.5px] border-[#e7e6f3] bg-lp-white drop-shadow-[0_6px_9px_rgba(27,22,80,0.06)] sm:h-20 sm:w-[240px]"
    >
      {mark}
      <span className="text-[18px] font-bold text-lp-heading sm:text-[22px]">{name}</span>
    </div>
  );
}

/**
 * 02 Job boards (Figma 525:617): a lilac inset card naming the boards a link can come from.
 *
 * At rest it is the board: the heading over one row of five chips (wrapping on narrow screens).
 * Motion only brings it in: the card rises, the heading lands, the chips follow one by one.
 */
export function JobBoards() {
  const root = useRef<HTMLElement>(null);

  useLandingMotion(root, () => {
    const q = gsap.utils.selector(root);
    gsap
      .timeline({
        scrollTrigger: {
          trigger: root.current,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      })
      .from(q('[data-boards-card]'), {
        y: 60,
        opacity: 0,
        scale: 0.97,
        duration: 1,
        ease: 'expo.out',
      })
      .from(
        q('[data-boards-title] > *'),
        { y: 24, opacity: 0, duration: 0.8, stagger: 0.12, ease: 'expo.out' },
        '-=0.7',
      )
      .from(
        q('[data-board-chip]'),
        { y: 24, opacity: 0, duration: 0.8, stagger: 0.07, ease: 'expo.out' },
        '-=0.6',
      );
  });

  return (
    <section id="job-boards" ref={root} className="mt-10 px-3 sm:px-5">
      <div
        data-boards-card
        className="mx-auto flex max-w-[1400px] flex-col items-center gap-8 overflow-clip rounded-[28px] bg-[#f3f1ff] px-5 py-10 sm:rounded-[36px] sm:p-12"
      >
        <h2
          data-boards-title
          className="px-6 text-center text-[24px] leading-[32px] font-semibold tracking-[-0.68px] text-lp-heading sm:text-[28px] lg:text-[34px] lg:whitespace-nowrap"
        >
          <span className="inline-block">Paste a link from the boards you</span>{' '}
          <span className="inline-block">
            <AccentWord className="text-lp-violet">already</AccentWord> use
          </span>
        </h2>
        <div className="flex w-full flex-wrap justify-center gap-4 sm:gap-[22px]">
          {BOARDS.map((board) => (
            <BoardChip key={board.name} {...board} />
          ))}
        </div>
      </div>
    </section>
  );
}
