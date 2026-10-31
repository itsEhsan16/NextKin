'use client';

import { flushEvents, track } from '@nextkin/shared/queries';
import { useEffect } from 'react';

/** One usage event for each time the signed-in app opens, sent before the tab goes away. */
export function AppOpened() {
  useEffect(() => {
    track('app_opened');
    window.addEventListener('pagehide', flushEvents);
    return () => window.removeEventListener('pagehide', flushEvents);
  }, []);
  return null;
}
