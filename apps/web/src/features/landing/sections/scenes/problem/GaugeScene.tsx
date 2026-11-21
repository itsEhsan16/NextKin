'use client';

import { useRef } from 'react';

import { useSceneLoop } from '../../../motion/loop';

/** Server and browser trig differ in the last float digit; rounding keeps hydration identical. */
const round2 = (n: number) => Math.round(n * 100) / 100;

/** 58 minutes on a 0–80 dial. */
const MINUTES = 58;
const MAX = 80;
const FRACTION = MINUTES / MAX;
/** Needle angle: -90° points at 0 (left), +90° at MAX (right). */
const ANGLE = -90 + 180 * FRACTION;
const TICKS = Array.from({ length: 17 }, (_, i) => i);

/**
 * "Hours of manual rewriting": a speed dial (after the reference's "Build faster" card). The ember
 * arc fills, the needle sweeps to 58 min with a little overshoot, and the readout counts up.
 */
export function GaugeScene() {
  const root = useRef<HTMLDivElement>(null);

  useSceneLoop(
    root,
    (tl, q) => {
      const value = q('[data-gauge-value]')[0] as HTMLElement;
      const state = { n: 0 };
      tl.fromTo(
        q('[data-gauge-arc]'),
        { attr: { 'stroke-dasharray': '0 100' } },
        {
          attr: { 'stroke-dasharray': `${FRACTION * 100} 100` },
          duration: 1.6,
          ease: 'power3.out',
        },
        0,
      )
        .fromTo(
          q('[data-gauge-needle]'),
          { rotation: -90, svgOrigin: '120 120' },
          { rotation: ANGLE, svgOrigin: '120 120', duration: 1.6, ease: 'back.out(1.6)' },
          0,
        )
        .fromTo(
          state,
          { n: 0 },
          {
            n: MINUTES,
            duration: 1.6,
            ease: 'power3.out',
            onUpdate: () => {
              value.textContent = String(Math.round(state.n));
            },
          },
          0,
        )
        .fromTo(
          q('[data-gauge-chip]'),
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5 },
          1.1,
        );
    },
    { repeatDelay: 2.4 },
  );

  return (
    <div
      ref={root}
      className="relative mx-auto mt-6 flex w-full max-w-[300px] flex-col items-center px-6"
    >
      <svg viewBox="0 0 240 140" className="w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="lp-gauge-ember" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#8b7cff" />
            <stop offset="0.6" stopColor="#c084fc" />
            <stop offset="1" stopColor="#e879f9" />
          </linearGradient>
        </defs>
        {TICKS.map((i) => {
          const a = Math.PI - (Math.PI * i) / (TICKS.length - 1);
          const r1 = i % 4 === 0 ? 84 : 90;
          return (
            <line
              key={i}
              x1={round2(120 + Math.cos(a) * r1)}
              y1={round2(120 - Math.sin(a) * r1)}
              x2={round2(120 + Math.cos(a) * 98)}
              y2={round2(120 - Math.sin(a) * 98)}
              stroke="rgba(85,67,238,0.3)"
              strokeWidth={i % 4 === 0 ? 2 : 1}
              strokeLinecap="round"
            />
          );
        })}
        <path
          d="M 44 120 A 76 76 0 0 1 196 120"
          fill="none"
          stroke="#ece9fe"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          data-gauge-arc
          d="M 44 120 A 76 76 0 0 1 196 120"
          pathLength={100}
          fill="none"
          stroke="url(#lp-gauge-ember)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${FRACTION * 100} 100`}
        />
        <g data-gauge-needle transform={`rotate(${ANGLE} 120 120)`}>
          <line
            x1="120"
            y1="120"
            x2="120"
            y2="52"
            stroke="#2a2e45"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
        <circle
          cx="120"
          cy="120"
          r="11"
          fill="#ffffff"
          stroke="rgba(85,67,238,0.35)"
          strokeWidth="2"
        />
        <circle cx="120" cy="120" r="4" fill="#e879f9" />
      </svg>
      <p className="-mt-1 flex items-baseline gap-1.5">
        <span
          data-gauge-value
          className="text-[40px] leading-none font-semibold text-lp-heading tabular-nums"
        >
          {MINUTES}
        </span>
        <span className="text-[15px] font-medium text-lp-on-glass-dim">min</span>
      </p>
      <span
        data-gauge-chip
        className="lp-glass-panel mt-3 rounded-full px-3 py-1 text-[11.5px] font-medium text-lp-on-glass-dim"
      >
        per application, rewriting by hand
      </span>
    </div>
  );
}
