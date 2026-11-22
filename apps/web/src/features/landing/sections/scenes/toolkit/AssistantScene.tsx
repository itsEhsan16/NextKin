'use client';

import { useRef } from 'react';

import { cn } from '@/lib/cn';

import { useSceneLoop } from '../../../motion/loop';

const PROMPT = 'What does this job want most?';

/** Suggestions the assistant offers (illustrative actions it really has). */
const SUGGESTIONS = [
  { label: 'Tailor my resume to this job', key: 'T' },
  { label: 'Which skills am I missing?', key: 'S' },
  { label: 'Draft a cover letter', key: 'C' },
] as const;

/**
 * Assistant scene (after the reference's "Search command" palette): a glass command palette.
 * The question types itself into the field, then the highlight steps through the suggestions and
 * settles on the first, which pulses as if picked.
 */
export function AssistantScene() {
  const root = useRef<HTMLDivElement>(null);
  useSceneLoop(
    root,
    (tl, q) => {
      const field = q('[data-typed]')[0];
      const rows = q('[data-row-on]');
      const typing = { n: 0 };
      tl.fromTo(
        typing,
        { n: 0 },
        {
          n: PROMPT.length,
          duration: 1.6,
          ease: 'none',
          onUpdate: () => {
            if (field) field.textContent = PROMPT.slice(0, Math.round(typing.n));
          },
        },
        0,
      );
      // Highlight steps through the rows, then back to the first.
      tl.fromTo(rows[0]!, { opacity: 0 }, { opacity: 1, duration: 0.25 }, 1.8)
        .to(rows[0]!, { opacity: 0, duration: 0.25 }, 2.4)
        .fromTo(rows[1]!, { opacity: 0 }, { opacity: 1, duration: 0.25 }, 2.4)
        .to(rows[1]!, { opacity: 0, duration: 0.25 }, 3.0)
        .fromTo(rows[2]!, { opacity: 0 }, { opacity: 1, duration: 0.25 }, 3.0)
        .to(rows[2]!, { opacity: 0, duration: 0.25 }, 3.6)
        .to(rows[0]!, { opacity: 1, duration: 0.25 }, 3.6)
        .fromTo(
          q('[data-pick]'),
          { scale: 1 },
          { scale: 0.97, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.inOut' },
          4.1,
        );
    },
    { repeatDelay: 2.4 },
  );

  return (
    <div ref={root} className="lp-glass-panel flex flex-col overflow-hidden rounded-[18px]">
      <div className="flex items-center gap-3 border-b border-lp-violet-line px-4 py-3.5">
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          width={16}
          height={16}
          className="text-lp-on-glass-dim"
        >
          <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth={1.6} />
          <path
            d="m13.2 13.2 3.3 3.3"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </svg>
        <span className="min-w-0 flex-1 truncate text-[14px] text-lp-heading">
          <span data-typed>{PROMPT}</span>
          <span
            aria-hidden
            className="ml-0.5 inline-block h-4 w-px translate-y-[3px] bg-lp-violet motion-safe:animate-pulse"
          />
        </span>
        <kbd className="rounded-md border border-lp-violet-line bg-lp-white px-1.5 py-0.5 text-[11px] text-lp-on-glass-dim">
          esc
        </kbd>
      </div>
      <div className="px-2 pt-3 pb-2">
        <p className="px-2.5 pb-2 text-[11px] font-semibold tracking-[0.08em] text-lp-on-glass-dim/80 uppercase">
          Ask NextKin
        </p>
        <ul className="flex flex-col gap-1">
          {SUGGESTIONS.map((s, i) => (
            <li
              key={s.label}
              data-pick={i === 0 ? '' : undefined}
              className="relative flex items-center justify-between gap-3 overflow-hidden rounded-[10px] px-2.5 py-2.5"
            >
              <span
                data-row-on
                aria-hidden
                className={cn(
                  'absolute inset-0 rounded-[10px] border border-lp-violet-line bg-[linear-gradient(90deg,rgba(139,124,255,0.18),rgba(139,124,255,0.04))]',
                  i === 0 ? 'opacity-100' : 'opacity-0',
                )}
              />
              <span className="relative text-[14px] text-lp-on-glass">{s.label}</span>
              <kbd className="relative rounded-md border border-lp-violet-line bg-lp-white px-1.5 py-0.5 text-[11px] text-lp-on-glass-dim">
                {s.key}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
