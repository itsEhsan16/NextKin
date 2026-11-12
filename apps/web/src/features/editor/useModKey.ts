'use client';

import { useSyncExternalStore } from 'react';

const noop = () => () => undefined;

/**
 * "⌘" on a Mac, "Ctrl" elsewhere, for the shortcut hints in the editor's tooltips (redesign R6c,
 * audit ED-15). The server render says "Ctrl"; the browser's own answer replaces it on hydration.
 */
export function useModKey(): string {
  return useSyncExternalStore(
    noop,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'),
    () => 'Ctrl',
  );
}
