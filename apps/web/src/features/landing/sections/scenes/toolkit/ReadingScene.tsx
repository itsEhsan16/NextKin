'use client';

import { Docx } from '@untitledui/file-icons/dist/docx';
import { Pdf } from '@untitledui/file-icons/dist/pdf';
import { useRef } from 'react';

import { useSceneLoop } from '../../../motion/loop';
import { countInto } from './shared';

/** The two uploaded files (528:918 / 528:941). */
const FILES = [
  { name: 'Resume.pdf', parts: 'Work, education, skills', Icon: Pdf },
  { name: 'Resume.docx', parts: 'Work, projects, skills', Icon: Docx },
] as const;

const TICKS = 14;

/**
 * Reading scene: two files on glass rows. A scan line glides across each row in turn; the read
 * meter's ticks fill behind it and "% read" counts to 100. Then both settle, dim, and go again.
 */
export function ReadingScene() {
  const root = useRef<HTMLDivElement>(null);
  useSceneLoop(
    root,
    (tl, q) => {
      q('[data-file]').forEach((row, i) => {
        const scan = row.querySelector('[data-scan]');
        const ticks = row.querySelectorAll('[data-tick]');
        const count = countInto(row.querySelector('[data-read]') ?? undefined, '% read');
        const icon = row.querySelector('[data-file-icon]');
        const at = i * 1.4;
        tl.fromTo(
          scan,
          { x: 0, opacity: 0 },
          {
            x: () => (row as HTMLElement).clientWidth,
            opacity: 1,
            duration: 1.3,
            ease: 'power1.inOut',
          },
          at,
        )
          .to(scan, { opacity: 0, duration: 0.2 }, at + 1.15)
          .fromTo(
            ticks,
            { opacity: 0.18, scaleY: 0.35 },
            { opacity: 1, scaleY: 1, duration: 0.25, stagger: 0.06, ease: 'power2.out' },
            at + 0.35,
          )
          .fromTo(
            count.state,
            { n: 0 },
            { n: 100, duration: 1.1, ease: 'power1.out', onUpdate: count.update },
            at + 0.2,
          )
          .fromTo(
            icon,
            { y: 0 },
            { y: -6, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' },
            at + 1.2,
          );
      });
      tl.to(q('[data-tick]'), { opacity: 0.18, scaleY: 0.35, duration: 0.5 }, '+=2.6');
    },
    { repeatDelay: 0.3 },
  );

  return (
    <div ref={root} className="flex flex-col gap-3">
      {FILES.map(({ name, parts, Icon }) => (
        <div
          key={name}
          data-file
          className="lp-glass-panel relative flex items-center gap-3 overflow-hidden rounded-[16px] px-4 py-4 sm:gap-[18px] sm:px-5 sm:py-[18px]"
        >
          <span
            data-scan
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-16 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(139,124,255,0.22)_45%,rgba(85,67,238,0.45)_50%,rgba(139,124,255,0.22)_55%,transparent)] opacity-0"
          />
          <span data-file-icon className="relative shrink-0">
            <Icon className="size-11" />
          </span>
          <div className="relative flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-[16px] font-semibold text-lp-heading sm:text-[17px]">
              {name}
            </span>
            <span className="truncate text-[13px] text-lp-on-glass-dim sm:text-[14px]">
              {parts}
            </span>
          </div>
          <div className="relative flex shrink-0 flex-col items-end gap-2">
            <span data-read className="text-[13px] font-medium text-lp-on-glass tabular-nums">
              100% read
            </span>
            <div className="flex gap-[3px] sm:gap-1" aria-hidden>
              {Array.from({ length: TICKS }, (_, i) => (
                <span
                  key={i}
                  data-tick
                  className="h-5 w-[4px] origin-bottom rounded-[3px] bg-lp-violet sm:w-1.5"
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
