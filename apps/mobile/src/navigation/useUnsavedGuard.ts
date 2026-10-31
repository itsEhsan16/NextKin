import { usePreventRemove } from 'expo-router';
import { useCallback, useState } from 'react';

export type UnsavedGuard = {
  /** The screen's discard `ConfirmSheet` is up. */
  open: boolean;
  /** The header chevron while dirty: raise the question, and run `leave` if the answer is Discard. */
  ask: (leave: () => void) => void;
  /** Discard: drop the edits and finish whichever way off the page was asked about. */
  confirm: () => void;
  /** Keep editing. */
  cancel: () => void;
  /** The edits are saved: let the next way off the page through without a question. */
  release: () => void;
};

/**
 * Asks before an edit is thrown away, however the person leaves. The forms asked only on the
 * header chevron, so the iOS edge swipe and Android's back — the ways most people go back on a
 * phone — dropped the edits without a word. This catches those as well, through navigation's own
 * removal prevention, and routes every one of them into the screen's single discard sheet.
 *
 * Pass `dirty` false while a save or a delete is in flight: those leave the page from their
 * `onSuccess`, which runs before the render that clears the busy flag, so the page goes without a
 * question. A save that leaves from a later promise calls `release` first.
 */
export function useUnsavedGuard(dirty: boolean): UnsavedGuard {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const disable = usePreventRemove(dirty, ({ repeat }) => setPending(() => repeat));

  const ask = useCallback((leave: () => void) => setPending(() => leave), []);

  const confirm = useCallback(() => {
    const leave = pending;
    setPending(null);
    disable();
    leave?.();
  }, [disable, pending]);

  const cancel = useCallback(() => setPending(null), []);

  return { open: pending != null, ask, confirm, cancel, release: disable };
}
