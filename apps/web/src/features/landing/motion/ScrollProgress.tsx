'use client';

import { motion, useScroll, useSpring } from 'motion/react';

/** A violet hairline across the top that fills as the page is read. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });
  return (
    <motion.div
      aria-hidden
      className="lp-button-gradient fixed inset-x-0 top-0 z-50 h-[3px] origin-left"
      style={{ scaleX }}
    />
  );
}
