'use client';

import Link from 'next/link';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { dismissToast, useToast, type ToastMessage, type ToastTone } from '@/lib/toast';

import { CheckIcon, CloseIcon, InfoCircleIcon } from './icons';

const ACTION =
  'shrink-0 rounded-sm px-1 font-semibold text-brand-on-dark underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-on-dark';

const TONE_ICON: Record<ToastTone, { Icon: typeof CheckIcon; className: string }> = {
  success: { Icon: CheckIcon, className: 'text-success-600' },
  error: { Icon: InfoCircleIcon, className: 'text-danger-dot' },
  info: { Icon: InfoCircleIcon, className: 'text-brand-on-dark' },
};

/**
 * The one place toasts appear (`toreview.md` §85): bottom-right of the window, over the page, on
 * the inverse surface so it reads as a message about the page rather than part of it. It grows in
 * from the press scale and fades back out; a new toast replaces the old one where it stands.
 *
 * Announced politely, or assertively for a failure. It never takes focus, and its own ✕ and link
 * are ordinary controls a keyboard can reach.
 */
export function Toaster() {
  const toast = useToast();
  // The toast on screen, kept for the length of its exit after the store has dropped it.
  const [shown, setShown] = useState<ToastMessage | null>(null);
  const [leaving, setLeaving] = useState(false);

  // Adjusted during render, not in an effect, so the swap never paints a frame late.
  if (toast && toast.id !== shown?.id) {
    setShown(toast);
    setLeaving(false);
  } else if (!toast && shown && !leaving) {
    setLeaving(true);
  }

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-6 bottom-6 z-toast flex max-w-sm flex-col items-end"
    >
      {shown && (
        <ToastBar
          key={shown.id}
          toast={shown}
          leaving={leaving}
          onLeft={() => {
            setShown(null);
            setLeaving(false);
          }}
        />
      )}
    </div>
  );
}

function ToastBar({
  toast,
  leaving,
  onLeft,
}: {
  toast: ToastMessage;
  leaving: boolean;
  onLeft: () => void;
}) {
  const { Icon, className } = TONE_ICON[toast.tone];

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      data-state={leaving ? 'closed' : 'open'}
      onAnimationEnd={leaving ? onLeft : undefined}
      className={cn(
        'flex origin-bottom-right items-center gap-3 rounded-xl bg-surface-inverse py-3.5 pr-2.5 pl-4 text-body-m text-text-inverse shadow-dialog',
        // A leaving toast takes no clicks (§196): its action can't fire again on the way out.
        leaving ? 'pointer-events-none animate-pop-out' : 'pointer-events-auto animate-pop-in',
      )}
    >
      <Icon className={cn('size-4 shrink-0', className)} />
      <span className="min-w-0 flex-1">{toast.message}</span>
      {toast.action &&
        ('href' in toast.action ? (
          <Link href={toast.action.href} onClick={dismissToast} className={ACTION}>
            {toast.action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              dismissToast();
              if (toast.action && 'onClick' in toast.action) toast.action.onClick();
            }}
            className={ACTION}
          >
            {toast.action.label}
          </button>
        ))}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismissToast}
        className="grid size-7 shrink-0 place-items-center rounded-sm text-text-inverse/70 transition-colors duration-press ease-standard hover:bg-surface-inverse-hover hover:text-text-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-on-dark"
      >
        <CloseIcon className="size-4" />
      </button>
    </div>
  );
}
