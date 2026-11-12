'use client';

import { useCurrentUser } from '@nextkin/shared/queries';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/Dialog';
import { useState } from 'react';

import { auth } from '@/lib/dataSource';
import { buttonClass } from '@/ui/Button';
import { Mail01 } from '@/ui/lineIcons';

/**
 * SYS 03 (868:469): a download refused because the email address isn't confirmed yet (V2 §7.1).
 * It says where the message went and offers to send it again. Once verified, one press downloads
 * again, rather than closing, finding the button and pressing it (redesign R6b, audit RS-55). A
 * resend's result is said in the dialog, not in a toast behind its scrim.
 */
export function VerifyEmailDialog({
  open,
  onClose,
  onRetry,
}: {
  open: boolean;
  onClose: () => void;
  /** Download again; still unverified, the dialog comes back. */
  onRetry?: () => void;
}) {
  const user = useCurrentUser();
  const email = user.data?.email;
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<'sent' | 'failed' | null>(null);
  const resend = () => {
    if (!email || sending) return;
    setSending(true);
    auth
      .resendCode(email)
      .then(() => setSent('sent'))
      .catch(() => setSent('failed'))
      .finally(() => setSending(false));
  };
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()} size="md">
      <div className="flex flex-col gap-3 px-5 pb-4 pt-5">
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-md bg-brand-50 text-text-brand"
        >
          <Mail01 className="size-5" />
        </span>
        <DialogTitle className="text-h2 font-bold text-text-primary">
          Verify your email first
        </DialogTitle>
        <DialogDescription className="text-body-l text-text-secondary">
          Downloads need a confirmed email address. We sent a message to{' '}
          {email ?? 'your email address'} — open it, then download again.
        </DialogDescription>
        <p className="text-body-m text-text-tertiary">
          Didn’t get it?{' '}
          <button
            type="button"
            disabled={sending || !email}
            onClick={resend}
            className="rounded-sm font-semibold text-text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Resend email'}
          </button>
        </p>
        {sent && (
          <p
            role="status"
            className={
              sent === 'sent'
                ? 'text-body-m text-feedback-success-text'
                : 'text-body-m text-feedback-danger-text'
            }
          >
            {sent === 'sent'
              ? `Sent again to ${email}.`
              : 'We couldn’t send it. Try again in a minute.'}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2.5 border-t border-border-default px-4 py-3.5">
        <DialogClose className={buttonClass({ variant: 'secondary', size: 'lg' })}>
          Close
        </DialogClose>
        {onRetry && (
          <button
            type="button"
            autoFocus
            onClick={() => {
              onClose();
              onRetry();
            }}
            className={buttonClass({ size: 'lg' })}
          >
            I’ve verified, download
          </button>
        )}
      </div>
    </Dialog>
  );
}
