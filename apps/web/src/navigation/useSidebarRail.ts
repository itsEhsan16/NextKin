'use client';

import { useEffect, useRef, useState } from 'react';

import { useMediaQuery } from '@/lib/useMediaQuery';

import { useSidebarCollapsed } from './useSidebarCollapsed';

/** Below this the window has no room for the panel beside the page: `theme.css`'s `rail` too. */
export const NARROW_SIDEBAR_QUERY = '(width < 80rem)';

/** Dispatched on `window` by the top bar's menu button to open the panel over the page. */
export const OPEN_SIDEBAR_EVENT = 'nextkin:open-sidebar';

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

  // The top bar's menu button (below 768, where there is no rail to click) asks for the panel.
  useEffect(() => {
    const open = () => {
      if (narrow) setOverlayFrom(pathname);
    };
    window.addEventListener(OPEN_SIDEBAR_EVENT, open);
    return () => window.removeEventListener(OPEN_SIDEBAR_EVENT, open);
  }, [narrow, pathname]);

  // While the panel is open over the page (redesign R4, audit SH-05): focus moves into it, the
  // page behind is inert (out of the tab order and the accessibility tree), and closing it puts
  // focus back where it was.
  useEffect(() => {
    if (!overlay) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const page = document.getElementById('main')?.parentElement;
    page?.setAttribute('inert', '');
    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>('[aria-current="page"]') ??
      panel?.querySelector<HTMLElement>('a[href], button:not([disabled])');
    first?.focus();
    return () => {
      page?.removeAttribute('inert');
      if (opener?.isConnected) opener.focus();
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
