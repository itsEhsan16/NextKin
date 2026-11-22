'use client';

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import Image from 'next/image';
import type { PointerEvent } from 'react';

import { cn } from '@/lib/cn';

/**
 * The 3D clay icons (owner, 2026-11-20): glossy gummy toys made with Weave GPT Image 2.6 (Figma
 * page "🧸 Landing 3D icons"). Since 2026-11-21 they are the owner's transparent cut-outs, so
 * each one stands free on the page: no tile, a soft contact shadow underneath (a static gradient,
 * never a filter on the moving object), a gentle float, and a tilt toward the pointer.
 */
export type ClayScene =
  | 'gift'
  | 'document'
  | 'shield'
  | 'gear'
  | 'paper-stack'
  | 'hourglass'
  | 'puzzle'
  | 'chain-link'
  | 'magnifier'
  | 'toggle'
  | 'gauge'
  | 'paper-plane'
  | 'grad-cap'
  | 'bar-chart'
  | 'scanner'
  | 'chat'
  // The proof band's role icons (2026-11-21, made transparent straight from Weave).
  | 'code'
  | 'megaphone'
  | 'database'
  | 'headset'
  | 'bug';

export function ClayTile({
  scene,
  size = 72,
  className,
  float = true,
  shadow = size >= 56,
  priority = false,
}: {
  scene: ClayScene;
  /** Rendered size in px. */
  size?: number;
  className?: string;
  float?: boolean;
  /** A soft contact shadow under the object (on by default for the larger icons). */
  shadow?: boolean;
  priority?: boolean;
}) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [12, -12]), {
    stiffness: 200,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-12, 12]), {
    stiffness: 200,
    damping: 18,
  });
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const leave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div
      aria-hidden
      className={cn('relative shrink-0 [perspective:600px]', className)}
      style={{ width: size, height: size }}
      onPointerMove={move}
      onPointerLeave={leave}
    >
      {shadow ? (
        <span className="pointer-events-none absolute -bottom-[6%] left-[18%] h-[14%] w-[64%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(40,24,120,0.28),transparent)]" />
      ) : null}
      <div className={cn('size-full', float && 'lp-clay-float')}>
        <motion.div style={{ rotateX, rotateY }} className="relative size-full">
          <Image
            src={`/landing/3d/clay-${scene}.webp`}
            alt=""
            fill
            priority={priority}
            sizes={`${size * 2}px`}
            className="object-contain"
          />
        </motion.div>
      </div>
    </div>
  );
}
