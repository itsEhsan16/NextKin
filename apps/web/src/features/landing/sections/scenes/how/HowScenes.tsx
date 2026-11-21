'use client';

import { useRef, type CSSProperties, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { useSceneLoop } from '../../../motion/loop';
import { ClayTile, type ClayScene } from '../../../parts/ClayTile';

/**
 * How it works, Landing v2 (owner 2026-11-20, toreview §251): each step's fragment is a small
 * dark glass scene with its 3D clay tile and its own looping micro-animation. Every scene renders
 * its final frame; the loops (useSceneLoop) run only while the step is on screen.
 */

const GLASS: CSSProperties = { borderRadius: 20 };

/** The glass frame every step scene sits in (keeps `data-how-fragment` for the route scrub). */
function Shell({
  scene,
  children,
  className,
  sceneRef,
}: {
  scene: ClayScene;
  children: ReactNode;
  className?: string;
  sceneRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={sceneRef}
      data-how-fragment
      className={cn('lp-glass relative w-full overflow-hidden p-4 pt-[58px]', className)}
      style={GLASS}
    >
      <span aria-hidden className="lp-glass-dots" />
      <ClayTile scene={scene} size={40} float={false} className="absolute top-3.5 left-4 z-[2]" />
      <div className="relative z-[2] flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

/** A small arrow pointer that moves and clicks, like the references' cursor. */
function FakeCursor({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      data-cursor
      viewBox="0 0 24 24"
      width={20}
      height={20}
      className={cn('pointer-events-none absolute z-[3] opacity-0', className)}
    >
      <path
        d="M4 2.5 19.5 11 12.6 12.6 9.6 19.5Z"
        fill="#ffffff"
        stroke="#1d1a5c"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Chip({ tone, children }: { tone: 'violet' | 'green' | 'orange'; children: ReactNode }) {
  return (
    <span
      data-how-chip
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap',
        tone === 'violet' && 'bg-lp-violet-soft text-lp-violet',
        tone === 'green' && 'bg-[#ecfdf5] text-[#047857]',
        tone === 'orange' && 'bg-[#fff7ed] text-[#c2410c]',
      )}
    >
      {children}
    </span>
  );
}

/** 1 · Paste the job: the link types itself into a field, then the job it found settles in. */
export function PasteScene() {
  const root = useRef<HTMLDivElement>(null);
  useSceneLoop(
    root,
    (tl, q) => {
      tl.fromTo(
        q('[data-paste-text]'),
        { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)', duration: 1.3, ease: 'steps(24)' },
        0,
      )
        .fromTo(
          q('[data-paste-caret]'),
          { opacity: 1 },
          { opacity: 0, duration: 0.2, repeat: 3, yoyo: true },
          1.3,
        )
        .fromTo(
          q('[data-paste-job]'),
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5 },
          1.5,
        )
        .fromTo(
          q('[data-paste-read]'),
          { scale: 0.5, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(3)' },
          1.8,
        );
    },
    { repeatDelay: 2.4 },
  );
  return (
    <Shell scene="chain-link" sceneRef={root}>
      <div className="lp-glass-panel flex items-center gap-1 rounded-[10px] px-2.5 py-2 text-[12px]">
        <span data-paste-text className="truncate text-lp-violet">
          linkedin.com/jobs/view/3829
        </span>
        <span data-paste-caret className="h-3.5 w-px shrink-0 bg-lp-violet" />
      </div>
      <div data-paste-job className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-lp-on-glass">Senior Product Designer · Acme</p>
        <span data-paste-read>
          <Chip tone="green">Read</Chip>
        </span>
      </div>
    </Shell>
  );
}

const ASKS = [
  ['Figma', 'In your resume', 'green'],
  ['Design systems', 'In your resume', 'green'],
  ['A/B testing', 'Gap', 'orange'],
] as const;

/** 2 · See what it asks: each requirement is read off the post and ticked, the gap marked. */
export function AsksScene() {
  const root = useRef<HTMLDivElement>(null);
  useSceneLoop(
    root,
    (tl, q) => {
      q('[data-ask-row]').forEach((row, i) => {
        const at = i * 0.35;
        tl.fromTo(row, { x: -10, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4 }, at)
          .fromTo(
            row.querySelector('[data-ask-tick] path') as Element,
            { attr: { 'stroke-dashoffset': 14 } },
            { attr: { 'stroke-dashoffset': 0 }, duration: 0.35, ease: 'power2.out' },
            at + 0.2,
          )
          .fromTo(
            row.querySelector('[data-how-chip]') as Element,
            { scale: 0.5, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(3)' },
            at + 0.3,
          );
      });
    },
    { repeatDelay: 2.2 },
  );
  return (
    <Shell scene="magnifier" sceneRef={root}>
      {ASKS.map(([skill, state, tone]) => (
        <div key={skill} data-ask-row className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <svg data-ask-tick viewBox="0 0 16 16" width={14} height={14} aria-hidden>
              <circle cx="8" cy="8" r="7" fill={tone === 'green' ? '#d1fae5' : '#ffedd5'} />
              <path
                d="M4.8 8.2 7 10.3 11.2 5.9"
                fill="none"
                stroke={tone === 'green' ? '#059669' : '#ea580c'}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="14"
                strokeDashoffset="0"
              />
            </svg>
            <span className="text-[13px] font-medium text-lp-on-glass">{skill}</span>
          </span>
          <Chip tone={tone}>{state}</Chip>
        </div>
      ))}
    </Shell>
  );
}

const TOGGLES = [
  { label: 'Accessibility audits', on: true },
  { label: 'Stakeholder workshops', on: false },
];

/**
 * 3 · Pick the keywords: a pointer flips the second switch on and back off. Nothing is
 * pre-selected beyond the first, as on the board; the final frame is the board's state.
 */
export function KeywordsScene() {
  const root = useRef<HTMLDivElement>(null);
  useSceneLoop(
    root,
    (tl, q) => {
      const cursor = q('[data-cursor]')[0] as Element;
      const knob = q('[data-toggle-knob="1"]')[0] as Element;
      const track = q('[data-toggle-track="1"]')[0] as Element;
      tl.fromTo(
        cursor,
        { x: 40, y: 34, opacity: 0 },
        { x: 0, y: 0, opacity: 1, duration: 0.7, ease: 'power2.inOut' },
        0,
      )
        .to(cursor, { scale: 0.82, duration: 0.1, yoyo: true, repeat: 1 }, 0.75)
        .fromTo(knob, { x: 0 }, { x: 16, duration: 0.3, ease: 'back.out(2)' }, 0.8)
        .fromTo(
          track,
          { backgroundColor: '#e4e1fb' },
          { backgroundColor: '#5543ee', duration: 0.3 },
          0.8,
        )
        .to(cursor, { scale: 0.82, duration: 0.1, yoyo: true, repeat: 1 }, 2.1)
        .to(knob, { x: 0, duration: 0.3, ease: 'back.out(2)' }, 2.15)
        .to(track, { backgroundColor: '#e4e1fb', duration: 0.3 }, 2.15)
        .to(cursor, { x: 40, y: 34, opacity: 0, duration: 0.6, ease: 'power2.in' }, 2.6);
    },
    { repeatDelay: 1.6 },
  );
  return (
    <Shell scene="toggle" sceneRef={root}>
      {TOGGLES.map((t, i) => (
        <div key={t.label} className="relative flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-lp-on-glass">{t.label}</span>
          <span
            data-toggle-track={i}
            className="relative flex h-5 w-9 shrink-0 items-center rounded-full px-0.5"
            style={{ backgroundColor: t.on ? '#5543ee' : '#e4e1fb' }}
          >
            <span
              data-toggle-knob={i}
              className="size-4 rounded-full bg-lp-white shadow-[0_1px_3px_rgba(27,22,80,0.25)]"
              style={t.on ? { transform: 'translateX(16px)' } : undefined}
            />
            {i === 1 ? <FakeCursor className="top-3 left-5" /> : null}
          </span>
        </div>
      ))}
      <p className="text-[11px] text-lp-on-glass-dim">Nothing is pre-selected.</p>
    </Shell>
  );
}

const SCORE = 86;

/** 4 · Score, with its basis: a small dial fills to 86 while the number counts up. */
export function ScoreScene() {
  const root = useRef<HTMLDivElement>(null);
  useSceneLoop(
    root,
    (tl, q) => {
      const value = q('[data-score-value]')[0] as HTMLElement;
      const state = { n: 0 };
      tl.fromTo(
        q('[data-score-arc]'),
        { attr: { 'stroke-dasharray': '0 100' } },
        { attr: { 'stroke-dasharray': `${SCORE} 100` }, duration: 1.4, ease: 'power3.out' },
        0,
      )
        .fromTo(
          state,
          { n: 0 },
          {
            n: SCORE,
            duration: 1.4,
            ease: 'power3.out',
            onUpdate: () => {
              value.textContent = String(Math.round(state.n));
            },
          },
          0,
        )
        .fromTo(q('[data-how-chip]'), { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, 1);
    },
    { repeatDelay: 2.4 },
  );
  return (
    <Shell scene="gauge" sceneRef={root}>
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 64 64" width={56} height={56} aria-hidden className="-rotate-90">
          <circle cx="32" cy="32" r="26" fill="none" stroke="#ece9fe" strokeWidth="7" />
          <circle
            data-score-arc
            cx="32"
            cy="32"
            r="26"
            pathLength={100}
            fill="none"
            stroke="#8b7cff"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${SCORE} 100`}
          />
        </svg>
        <p className="flex items-end gap-1.5 whitespace-nowrap">
          <span
            data-score-value
            className="text-[30px] leading-none font-semibold text-lp-heading tabular-nums"
          >
            {SCORE}
          </span>
          <span className="text-[13px] font-medium text-lp-on-glass-dim">/100</span>
        </p>
      </div>
      <div>
        <Chip tone="violet">19 of 21 required met</Chip>
      </div>
    </Shell>
  );
}

/** 5 · Send it: the PDF exports, the bar fills, and "Ready to send" ticks in. */
export function SendScene() {
  const root = useRef<HTMLDivElement>(null);
  useSceneLoop(
    root,
    (tl, q) => {
      tl.fromTo(
        q('[data-send-pdf]'),
        { y: -10, rotate: -10 },
        { y: 0, rotate: 0, duration: 0.5, ease: 'bounce.out' },
        0,
      )
        .fromTo(
          q('[data-send-bar]'),
          { scaleX: 0 },
          { scaleX: 1, duration: 1.2, ease: 'power2.inOut', transformOrigin: '0% 50%' },
          0.3,
        )
        .fromTo(
          q('[data-send-ready]'),
          { x: -6, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.4 },
          1.5,
        )
        .fromTo(
          q('[data-send-tick] path'),
          { attr: { 'stroke-dashoffset': 14 } },
          { attr: { 'stroke-dashoffset': 0 }, duration: 0.35 },
          1.6,
        );
    },
    { repeatDelay: 2.4 },
  );
  return (
    <Shell scene="paper-plane" sceneRef={root}>
      <div className="flex items-center gap-3">
        <span
          data-send-pdf
          className="flex h-10 w-[32px] shrink-0 items-end justify-center rounded-[6px] bg-[#ef4444] pb-[5px] text-[9px] font-bold text-lp-white"
        >
          PDF
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="truncate text-[13px] font-semibold text-lp-on-glass">Resume_Acme.pdf</p>
          <span className="h-1.5 w-full overflow-hidden rounded-full bg-lp-violet-soft">
            <span
              data-send-bar
              className="block h-full w-full rounded-full bg-[linear-gradient(90deg,#8b7cff,#34d399)]"
            />
          </span>
        </div>
      </div>
      <p
        data-send-ready
        className="flex items-center gap-1.5 text-[12px] font-medium text-[#047857]"
      >
        <svg data-send-tick viewBox="0 0 16 16" width={14} height={14} aria-hidden>
          <circle cx="8" cy="8" r="7" fill="#d1fae5" />
          <path
            d="M4.8 8.2 7 10.3 11.2 5.9"
            fill="none"
            stroke="#059669"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="14"
            strokeDashoffset="0"
          />
        </svg>
        Ready to send
      </p>
    </Shell>
  );
}
