'use client';

import { motion, useReducedMotion, useSpring } from 'motion/react';
import type { PointerEvent, ReactNode } from 'react';

const SPRING = { stiffness: 260, damping: 18, mass: 0.4 };

/**
 * A button or link that leans toward the pointer and springs back. Pass `href` for a link,
 * `type="submit"` for a form.
 */
export function MagneticButton({
  href,
  type = 'button',
  strength = 0.3,
  className,
  children,
  onClick,
  'aria-label': ariaLabel,
}: {
  href?: string;
  type?: 'button' | 'submit';
  strength?: number;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  'aria-label'?: string;
}) {
  const reduce = useReducedMotion();
  const x = useSpring(0, SPRING);
  const y = useSpring(0, SPRING);
  const move = (e: PointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * strength);
    y.set((e.clientY - r.top - r.height / 2) * strength);
  };
  const leave = () => {
    x.set(0);
    y.set(0);
  };
  const shared = {
    className,
    style: { x, y },
    onPointerMove: move,
    onPointerLeave: leave,
    whileTap: { scale: 0.96 },
    'aria-label': ariaLabel,
  };
  if (href) {
    return (
      <motion.a href={href} {...shared}>
        {children}
      </motion.a>
    );
  }
  return (
    <motion.button type={type} onClick={onClick} {...shared}>
      {children}
    </motion.button>
  );
}
