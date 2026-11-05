'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';

/**
 * A page's own last breadcrumb ("People › Users › Aarav Mehta", Figma 406:2360). The top bar
 * draws the group and the sidebar row on its own; a detail page names what it shows by calling
 * `useAdminCrumb(name)`, and the crumb clears when the page goes.
 *
 * The crumb remembers the path it was set for, and the top bar only shows it on that path. The
 * page's effect runs after the new route has painted, so without that a navigation would show the
 * previous record's name for a frame.
 */
type Crumb = { label: string; path: string };

let crumb: Crumb | null = null;
const listeners = new Set<() => void>();

function setCrumb(next: Crumb | null) {
  if (crumb?.label === next?.label && crumb?.path === next?.path) return;
  crumb = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** What the page at `pathname` put last in the breadcrumb, if anything. */
export function useAdminCrumbValue(pathname: string): string | null {
  const current = useSyncExternalStore(
    subscribe,
    () => crumb,
    () => null,
  );
  return current && current.path === pathname ? current.label : null;
}

/** Puts `label` last in the breadcrumb while the calling page is on screen. */
export function useAdminCrumb(label: string | null | undefined): void {
  const pathname = usePathname();
  useEffect(() => {
    setCrumb(label ? { label, path: pathname } : null);
    return () => setCrumb(null);
  }, [label, pathname]);
}
