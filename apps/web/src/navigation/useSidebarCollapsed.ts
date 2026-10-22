'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { storage } from '@/lib/storage';

import { applySidebarAttribute, SIDEBAR_STORAGE_KEY } from './sidebarBoot';

const listeners = new Set<() => void>();
let cached: boolean | null = null;

function read(): boolean {
  if (cached === null) cached = storage.get<boolean>(SIDEBAR_STORAGE_KEY) ?? false;
  return cached;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * Whether the user keeps the sidebar collapsed to the rail (304:600) rather than the expanded
 * panel (304:497) — on a window 1280px or wider; narrower windows always start on the rail
 * (`Sidebar.tsx`).
 *
 * `useSyncExternalStore` rather than an effect: `localStorage` is an external store, the server
 * has none, and reading it in an effect to call `setState` is the cascading-render pattern React
 * warns about. The server snapshot is "expanded", so React's first render says expanded either
 * way; what the user *sees* on first paint comes from the attribute `sidebarBootScript` sets on
 * `<html>` before anything paints, which the sidebar's CSS reads (`toreview.md` §84). `toggle`
 * keeps that attribute in step.
 */
export function useSidebarCollapsed(): { collapsed: boolean; toggle: () => void } {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);

  const toggle = useCallback(() => {
    cached = !read();
    storage.set(SIDEBAR_STORAGE_KEY, cached);
    applySidebarAttribute(cached);
    for (const listener of listeners) listener();
  }, []);

  return { collapsed, toggle };
}
