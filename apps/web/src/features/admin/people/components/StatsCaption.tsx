'use client';

import { showToast } from '@/lib/toast';

/**
 * A headline card's caption when its figures failed to load: says so and retries the whole row
 * of cards. "Not connected yet" stays for a source that serves no figures (`toreview.md` §171.4).
 */
export function RetryCaption({ onRetry }: { onRetry: () => void }) {
  return (
    <>
      Couldn’t load ·{' '}
      <button
        type="button"
        onClick={onRetry}
        aria-label="Try again loading the figures"
        className="rounded-tag font-semibold text-brand-700 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        Try again
      </button>
    </>
  );
}

/** Copies a value and says whether it worked: "Email copied", or that the browser refused. */
export function copyWithToast(text: string, done: string) {
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
  if (!clipboard) {
    showToast('Couldn’t copy. Your browser blocked the clipboard.', { tone: 'error' });
    return;
  }
  clipboard.writeText(text).then(
    () => showToast(done),
    () => showToast('Couldn’t copy. Your browser blocked the clipboard.', { tone: 'error' }),
  );
}
