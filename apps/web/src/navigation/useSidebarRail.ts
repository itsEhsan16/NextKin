'use client';

import { useEffect, useRef, useState } from 'react';

import { useMediaQuery } from '@/lib/useMediaQuery';

import { useSidebarCollapsed } from './useSidebarCollapsed';

/** Below this the window has no room for the panel beside the page: `theme.css`'s `rail` too. */
export const NARROW_SIDEBAR_QUERY = '(width < 80rem)';

/**
 * Whether the sidebar is the rail, and what its toggle does (`toreview.md` §84).
 *
 * From 1280px up the toggle flips the remembered preference, and the panel pushes the page over
 * by its width. Below that the sidebar is always the rail beside the page; the toggle opens the
 * panel *over* the page, and it closes again on Escape, a press outside it, or a route change.
 * That overlay is never remembered.
 *
 * `rail` is what React knows, after hydration. How the sidebar looks is CSS (`rail:` classes),
 * which is right from the first paint; this decides only what CSS can't express: labels, tab
 * order, tooltips.
 */
export function useSidebarRail(pathname: string) {
  const { collapsed, toggle } = useSidebarCollapsed();
  const narrow = useMediaQuery(NARROW_SIDEBAR_QUERY);

  // The pathname it opened on. Dropped during render, not in an effect, when the route moves or
  // the window widens — the same pattern as the sidebar's pending click.
  const [overlayFrom, setOverlayFrom] = useState<string | null>(null);
  if (overlayFrom !== null && (!narrow || overlayFrom !== pathname)) setOverlayFrom(null);
  const overlay = narrow && overlayFrom !== null;

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!overlay) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOverlayFrom(null);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOverlayFrom(null);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [overlay]);

  return {
    rail: narrow ? !overlay : collapsed,
    overlay,
    panelRef,
    toggle: () => (narrow ? setOverlayFrom(overlay ? null : pathname) : toggle()),
    closeOverlay: () => setOverlayFrom(null),
  };
}
