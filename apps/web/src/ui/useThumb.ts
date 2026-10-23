'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * The raised pill that slides between a control's options (toreview §132): Preview | Text view,
 * the list filters. It measures the chosen option inside the track and returns where to draw the
 * thumb; it follows the option when the track resizes (labels load, the window narrows). The first
 * placement does not animate, so nothing sweeps in from the left on load.
 */
export function useThumb(activeIndex: number) {
  const track = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [placed, setPlaced] = useState(false);

  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    const measure = () => {
      const item = el.querySelectorAll<HTMLElement>('[data-thumb-item]')[activeIndex];
      setBox(item ? { x: item.offsetLeft, y: item.offsetTop, w: item.offsetWidth, h: item.offsetHeight } : null);
    };
    measure();
    const frame = requestAnimationFrame(() => setPlaced(true));
    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(frame);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [activeIndex]);

  const style: CSSProperties | undefined = box
    ? { width: box.w, height: box.h, translate: `${box.x}px ${box.y}px` }
    : undefined;
  return [track, { style, visible: box != null, placed }] as const;
}
