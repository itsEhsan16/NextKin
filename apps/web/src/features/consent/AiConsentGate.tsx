'use client';

import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/Dialog';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { onConsentRequired, useAiConsent, useGrantAiConsent } from '@nextkin/shared/queries';

import { backButton, primaryButton } from '@/features/create/jobFlow/FlowChrome';
import { showToast } from '@/lib/toast';
import { AiAssistantIcon, ShieldCheckIcon } from '@/ui/icons';
import { StableLabel } from '@/ui/StableLabel';

/**
 * The AI consent dialog (ImBackendImplementationPlan P12-12; V2 §8.5; SYS 01, 868:225). It opens the first time an AI action is refused for want of
 * consent, names the providers and what each does, and records agreement to that version of the
 * list; then the action the person asked for carries on by itself (toreview §114): the refused
 * request is run again, with its own callbacks, so Analyze opens tailoring and Create starts.
 */
export function AiConsentGate() {
  const [open, setOpen] = useState(false);
  const consent = useAiConsent();
  const grant = useGrantAiConsent();

  const retry = useRef<(() => void) | null>(null);
  useEffect(
    () =>
      onConsentRequired((again) => {
        retry.current = again;
        setOpen(true);
      }),
    [],
  );

  const list = consent.data?.current;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // "Not now": nothing carries on.
        if (!next) retry.current = null;
      }}
      size="md"
    >
      <div className="flex flex-col gap-3.5 px-6.5 pb-5 pt-5.5">
        <Image
          src="/illustrations/v2/ai-consent.webp"
          alt=""
          width={526}
          height={560}
          className="h-47 w-auto object-contain"
        />
        <DialogTitle className="text-h2 font-bold text-text-primary">
          Before NextKin uses AI
        </DialogTitle>
        <DialogDescription className="text-body-l font-medium text-text-secondary">
          To read your documents and write new ones, NextKin sends their content to:
        </DialogDescription>
        <ul className="flex flex-col gap-2">
          {list?.providers.map((p) => (
            <li key={p.name} className="flex gap-3 rounded-lg bg-neutral-50 px-3.5 py-3">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-card text-text-brand"
              >
                <AiAssistantIcon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-body-l font-bold text-text-primary">{p.name}</span>
                <span className="block text-body-m font-medium text-text-secondary">
                  {p.purpose}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2.5 text-body-m font-semibold text-success-text">
          <ShieldCheckIcon aria-hidden className="size-4 shrink-0 text-success-600" />
          Your name, email, phone and address are never sent.
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2.5 border-t border-border-default pb-4 pl-6 pr-5 pt-3.5">
        <DialogClose className={backButton}>Not now</DialogClose>
        <button
          type="button"
          disabled={!list || grant.isPending}
          onClick={() =>
            list &&
            grant.mutate(list.version, {
              onSuccess: () => {
                const again = retry.current;
                retry.current = null;
                setOpen(false);
                if (again) again();
                else showToast('Thanks. Try that again now.');
              },
              onError: () => showToast('That didn’t save. Try again.', { tone: 'error' }),
            })
          }
          className={primaryButton}
        >
          <StableLabel label="Agree and continue" busyLabel="Saving…" busy={grant.isPending} />
        </button>
      </div>
    </Dialog>
  );
}
