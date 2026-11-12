'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { CheckCircle } from '@/ui/lineIcons';

type State = 'idle' | 'saving' | 'saved' | 'error';

/** How long "Saved" stays before it fades. */
const SAVED_MS = 2000;

/**
 * Feedback for a setting saved the moment it changes (redesign R7b, audit ST-06): "Saving…", then
 * "Saved" for two seconds, or a toast when it fails. Wrap the mutation's call:
 * `saved.run((options) => update.mutate(patch, options))`, and show `<SaveStatus>` in the card.
 */
export function useSaveStatus() {
  const [state, setState] = useState<State>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const run = (call: (options: { onSuccess: () => void; onError: () => void }) => void) => {
    clearTimeout(timer.current);
    setState('saving');
    call({
      onSuccess: () => {
        setState('saved');
        timer.current = setTimeout(() => setState('idle'), SAVED_MS);
      },
      onError: () => {
        setState('error');
        showToast('Couldn’t save that change. Try again.', { tone: 'error' });
      },
    });
  };
  return { state, run };
}

/** The card header's "Saving… / Saved" line, read out politely. */
export function SaveStatus({ state }: { state: State }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-1.5 text-caption-m font-medium transition-opacity duration-base ease-standard',
        state === 'idle' ? 'opacity-0' : 'opacity-100',
        state === 'error' ? 'text-feedback-danger-text' : 'text-text-tertiary',
      )}
    >
      {state === 'saved' && <CheckCircle aria-hidden className="size-4 text-success-600" />}
      {state === 'saving'
        ? 'Saving…'
        : state === 'saved'
          ? 'Saved'
          : state === 'error'
            ? 'Not saved'
            : ''}
    </span>
  );
}
