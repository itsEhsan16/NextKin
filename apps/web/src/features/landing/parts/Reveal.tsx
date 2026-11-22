'use client';

import { useRef, type ElementType, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { gsap, SplitText, useLandingMotion } from '../motion/gsap';

/**
 * A heading or paragraph whose lines (or words) rise out of a mask as it scrolls into view. The
 * text is server-rendered whole; SplitText only wraps it on the client, and re-splits on resize.
 */
export function Reveal({
  as: Tag = 'div',
  children,
  className,
  by = 'lines',
  delay = 0,
  immediate = false,
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  by?: 'lines' | 'words';
  delay?: number;
  /** Play on mount instead of on scroll (the hero). */
  immediate?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useLandingMotion(ref, () => {
    const el = ref.current;
    if (!el) return;
    const split = SplitText.create(el, {
      type: by === 'words' ? 'lines,words' : 'lines',
      mask: 'lines',
      linesClass: 'lp-line-mask',
      autoSplit: true,
      onSplit(self) {
        const targets = by === 'words' ? self.words : self.lines;
        return gsap.from(targets, {
          yPercent: 110,
          rotate: by === 'words' ? 3 : 0,
          opacity: 0,
          duration: 1.1,
          ease: 'expo.out',
          stagger: by === 'words' ? 0.05 : 0.1,
          delay,
          scrollTrigger: immediate
            ? undefined
            : { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
        });
      },
    });
    return () => split.revert();
  });
  return (
    <Tag ref={ref} className={cn(className)}>
      {children}
    </Tag>
  );
}
