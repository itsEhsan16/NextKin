import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Linking } from 'react-native';

import { takeSharedText } from '@/lib/incomingShare';

import { useShareStore } from './shareStore';

/**
 * A job shared from a browser or another app (owner, 2026-11-01, toreview §147.4). Mounted while
 * signed in, so it picks up a share from a cold start, from the background, and from before sign-in.
 */
export function ShareHost() {
  const router = useRouter();
  const setText = useShareStore((state) => state.setText);
  const ready = useRootNavigationState()?.key != null;

  useEffect(() => {
    if (!ready) return;
    const check = () => {
      const text = takeSharedText();
      if (!text) return;
      setText(text);
      router.push('/share');
    };
    check();
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    const link = Linking.addEventListener('url', check);
    return () => {
      foreground.remove();
      link.remove();
    };
  }, [ready, router, setText]);

  return null;
}
