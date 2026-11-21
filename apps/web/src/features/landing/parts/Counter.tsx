'use client';

import { useRef } from 'react';

import { gsap, useLandingMotion } from '../motion/gsap';

/**
 * A number that counts up when it scrolls into view. Server-rendered at its final value, so with
 * reduced motion or no JS the right number is already there.
 */
export function Counter({
  to,
  from = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1.6,
  delay = 0,
  className,
}: {
  to: number;
  from?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const format = (n: number) => `${prefix}${n.toFixed(decimals)}${suffix}`;
  useLandingMotion(ref, () => {
    const el = ref.current;
    if (!el) return;
    const state = { n: from };
    el.textContent = format(from);
    const tween = gsap.to(state, {
      n: to,
      duration,
      delay,
      ease: 'power3.out',
      onUpdate: () => {
        el.textContent = format(state.n);
      },
      scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' },
    });
    return () => {
      tween.kill();
      el.textContent = format(to);
    };
  });
  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {format(to)}
    </span>
  );
}
