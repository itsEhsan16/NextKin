import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { AppState } from 'react-native';

import { jobLinkIn } from '@/data/models';
import { readClipboardLink, storage } from '@/lib';

import { useHomeStore } from '../homeStore';

const ASKED_KEY = 'home.copiedJobLinksAsked';
/** Enough to never ask twice about the links anyone copies in a stretch of job hunting. */
const ASKED_MAX = 30;

/** Links already asked about, newest first. Each is asked about once, whatever the answer. */
export function wasAsked(url: string): boolean {
  return (storage.get<string[]>(ASKED_KEY) ?? []).includes(url);
}

export function markAsked(url: string): void {
  const asked = (storage.get<string[]>(ASKED_KEY) ?? []).filter((item) => item !== url);
  storage.set(ASKED_KEY, [url, ...asked].slice(0, ASKED_MAX));
}

/**
 * TAILOR 00c: "We only check when you open NextKin." Home looks at the clipboard when it comes
 * into view and whenever the app comes back to the front on it — never in the background, and
 * never on another tab. A job link not asked about before is handed to the host, which reads it
 * and only then opens the dialog.
 */
export function useCopiedJobLink(): void {
  const found = useHomeStore((state) => state.foundCopiedLink);
  const dropPending = useHomeStore((state) => state.dropPendingCopiedLink);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const check = async () => {
        const url = jobLinkIn(await readClipboardLink());
        if (!active || !url || wasAsked(url)) return;
        markAsked(url);
        found(url);
      };
      void check();
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') void check();
      });
      return () => {
        active = false;
        sub.remove();
        dropPending();
      };
    }, [dropPending, found]),
  );
}
