'use client';

import { useRef } from 'react';

import { cn } from '@/lib/cn';

import { useSceneLoop } from '../../../motion/loop';

const CLAIMS = [
  { skill: 'Figma', basis: 'Backed by 3 projects', ok: true },
  { skill: 'Kubernetes', basis: 'Added to pass the filter', ok: false },
  { skill: 'SQL', basis: 'Used weekly at Acme', ok: true },
] as const;

/**
 * "Skills that quietly don't match": an interview-prep inbox (after the reference's inbox card).
 * The claims slide in; the one added for the filter flags "Can't defend this" with a soft red
 * pulse.
 */
export function FlagScene() {
  const root = useRef<HTMLDivElement>(null);

  useSceneLoop(
    root,
    (tl, q) => {
      tl.fromTo(
        q('[data-flag-row]'),
        { x: -14, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.55, stagger: 0.14 },
        0,
      )
        .fromTo(
          q('[data-flag-pill]'),
          { scale: 0.5, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(3)' },
          0.7,
        )
        .fromTo(
          q('[data-flag-row-bad]'),
          { borderColor: 'rgba(85,67,238,0.12)' },
          { borderColor: 'rgba(244,63,94,0.55)', duration: 0.4 },
          0.7,
        );
      // Two soft pulses from the warning dot.
      for (const at of [0.9, 1.7]) {
        tl.fromTo(
          q('[data-flag-pulse]'),
          { scale: 1, opacity: 0.7 },
          { scale: 3.2, opacity: 0, duration: 1, ease: 'power2.out' },
          at,
        );
      }
    },
    { repeatDelay: 2 },
  );

  return (
    <div ref={root} className="relative mx-5 mt-5 sm:mx-6">
      <div className="lp-glass-panel rounded-[18px] p-3.5">
        <div className="flex items-center justify-between px-1 pb-3">
          <span className="text-[13px] font-semibold text-lp-on-glass">Interview prep</span>
          <span className="flex items-center gap-1.5 text-[11px] text-lp-on-glass-dim">
            Claims
            <span className="rounded-md bg-lp-violet-soft px-1.5 text-[10.5px] font-semibold text-lp-violet">
              3
            </span>
          </span>
        </div>
        <ul className="flex flex-col gap-2">
          {CLAIMS.map((c) => (
            <li
              key={c.skill}
              data-flag-row
              {...(c.ok ? {} : { 'data-flag-row-bad': '' })}
              className={cn(
                'flex items-center gap-3 rounded-[12px] border px-3 py-2.5',
                c.ok
                  ? 'border-lp-violet-line bg-lp-white'
                  : 'border-[rgba(244,63,94,0.55)] bg-[#fff1f2]',
              )}
            >
              <span className="relative flex size-2.5 shrink-0">
                {!c.ok ? (
                  <span
                    data-flag-pulse
                    className="absolute inset-0 rounded-full bg-[#f43f5e] opacity-0"
                  />
                ) : null}
                <span
                  className={cn(
                    'relative size-2.5 rounded-full',
                    c.ok ? 'bg-[#10b981]' : 'bg-[#f43f5e]',
                  )}
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13px] font-semibold text-lp-on-glass">{c.skill}</span>
                <span className="truncate text-[11px] text-lp-on-glass-dim">{c.basis}</span>
              </span>
              {c.ok ? (
                <span className="text-[10.5px] font-medium whitespace-nowrap text-[#047857]">
                  Defensible
                </span>
              ) : (
                <span
                  data-flag-pill
                  className="rounded-full bg-[#f43f5e] px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap text-lp-white"
                >
                  Can’t defend this
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
