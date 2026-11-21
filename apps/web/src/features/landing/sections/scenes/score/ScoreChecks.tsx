'use client';

import { useRef } from 'react';

import { useSceneOnce } from '../../../motion/loop';

const CHECKS = [
  'Reads the job’s real requirements',
  'Never adds skills you don’t have',
  'Catches impossible dates and tech',
  'Exports clean, ATS-safe PDFs',
];

/**
 * The four checks beside the Match overview. Each row slides in, its violet box pops, and the
 * tick inside is drawn stroke by stroke. Rendered with the ticks already drawn.
 */
export function ScoreChecks() {
  const root = useRef<HTMLUListElement>(null);
  useSceneOnce(root, (tl, q) => {
    tl.from(q('[data-check]'), { x: -20, opacity: 0, duration: 0.7, stagger: 0.12 })
      .from(
        q('[data-check-box]'),
        { scale: 0.4, rotate: -45, duration: 0.5, stagger: 0.12, ease: 'back.out(2.6)' },
        '<0.1',
      )
      .from(
        q('[data-tick]'),
        { drawSVG: '0%', duration: 0.45, stagger: 0.12, ease: 'power2.out' },
        '<0.25',
      );
  });

  return (
    <ul ref={root} className="mt-8 flex flex-col gap-5">
      {CHECKS.map((label) => (
        <li key={label} data-check className="flex items-center gap-3.5">
          <span
            data-check-box
            className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-[linear-gradient(135deg,#7d71f8_0%,#5543ee_71%)] shadow-[0_4px_12px_rgba(85,67,238,0.35)]"
          >
            <svg aria-hidden viewBox="0 0 20 20" width={16} height={16} fill="none">
              <path
                data-tick
                d="M5 10.5 8.5 14 15 6.5"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-lp-white"
              />
            </svg>
          </span>
          <span className="text-[17px] font-medium text-lp-ink-2 sm:text-[20px]">{label}</span>
        </li>
      ))}
    </ul>
  );
}
