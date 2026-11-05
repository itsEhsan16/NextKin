'use client';

import { useLayoutEffect } from 'react';

/**
 * The admin portal is drawn at 1920 wide (Figma 382:936), and the owner wants it to look like
 * the board on a laptop too, the way MiTow's admin does (2026-11-05): the same composition, just
 * smaller, rather than a reflowed layout. So the whole portal scales with the window: 1 at a 1920
 * content box, down to 0.8 (a 1536px window, a 1920 screen at 125%). Below that it stops
 * shrinking, so text never gets smaller than 80% of the board's, and the container queries reflow.
 *
 * The scale is `zoom` on `<body>` while the admin shell is on the page (`theme.css`,
 * `body:has([data-admin-shell])`), so the page and its menus, tooltips and dialogs, which render
 * into `<body>`, scale together. It is measured against the content box (`clientWidth`), not the
 * window: `<html>` reserves a scrollbar gutter, and a 1920 window has 1905px of content, so the
 * board's 1920 maps onto those 1905 (toreview §171.10).
 *
 * Two paths set it. The inline script runs before the first paint of a full load, so the first
 * frame is already at the right size. `useAdminScale` covers a client-side entry (staff sign-in
 * navigates into the portal without a reload, and React never runs a script it renders on the
 * client) and keeps the scale in step as the window is resized.
 */
export const ADMIN_BOARD_WIDTH = 1920;
export const ADMIN_MIN_SCALE = 0.8;

export const adminScaleScript = `(function(){var s=document.documentElement.style;s.setProperty('--admin-zoom',String(Math.min(1,Math.max(${ADMIN_MIN_SCALE},document.documentElement.clientWidth/${ADMIN_BOARD_WIDTH}))))})()`;

/** The zoom that fits the 1920 board to this window's content box. */
export function adminScale(): number {
  const width = document.documentElement.clientWidth;
  return Math.min(1, Math.max(ADMIN_MIN_SCALE, width / ADMIN_BOARD_WIDTH));
}

/** Sets the scale now and on every resize, for as long as the admin shell is mounted. */
export function useAdminScale(): void {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    const apply = () => root.setProperty('--admin-zoom', String(adminScale()));
    apply();
    window.addEventListener('resize', apply, { passive: true });
    return () => window.removeEventListener('resize', apply);
  }, []);
}
