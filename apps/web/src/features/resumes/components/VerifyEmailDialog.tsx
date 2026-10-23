'use client';

import { useCurrentUser } from '@nextkin/shared/queries';
import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

import { primaryButton } from '@/features/create/jobFlow/FlowChrome';
import { auth } from '@/lib/dataSource';
import { showToast } from '@/lib/toast';
import { Mail01 } from '@/ui/lineIcons';

import { promptDialog } from './AccuracyPrompt';

/**
 * SYS 03 (868:469): a download refused because the email address isn't confirmed yet (V2 §7.1).
 * It says where the message went and offers to send it again.
 */
export function VerifyEmailDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser();
  const email = user.data?.email;
  const [sending, setSending] = useState(false);
  const resend = () => {
    if (!email || sending) return;
    setSending(true);
    auth
      .resendCode(email)
      .then(() => showToast(`Sent again to ${email}.`, { tone: 'success' }))
      .catch(() => showToast('We couldn’t send it. Try again in a minute.', { tone: 'error' }))
      .finally(() => setSending(false));
  };
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-text-primary/40 data-[state=open]:animate-reveal" />
        <Dialog.Content className={promptDialog}>
          <div className="flex flex-col gap-3 px-5 pb-4 pt-5">
            <span
              aria-hidden
              className="flex size-11 items-center justify-center rounded-md bg-brand-50 text-text-brand"
            >
              <Mail01 className="size-5" />
            </span>
            <Dialog.Title className="text-h2 font-bold text-text-primary">
              Verify your email first
            </Dialog.Title>
            <Dialog.Description className="text-body-l text-text-secondary">
              Downloads need a confirmed email address. We sent a message to{' '}
              {email ?? 'your email address'} — open it, then download again.
            </Dialog.Description>
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
          </div>
          <div className="flex justify-end border-t border-border-default px-4 py-3.5">
            <Dialog.Close autoFocus className={primaryButton}>
              OK
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
