'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Skeleton } from '@/ui/Skeleton';
import { Callout } from '@/ui/Callout';
import { textLink } from '@/ui/textLink';
import { cn } from '@/lib/cn';
import {
  Dialog,
  DialogClose,
  DialogCloseButton,
  DialogHead,
  DialogHero,
  dialogBody,
  dialogFooter,
} from '@/ui/Dialog';
import { useEffect, useRef, useState } from 'react';

import { onConsentRequired, useAiConsent, useGrantAiConsent } from '@nextkin/shared/queries';

import { buttonClass } from '@/ui/Button';
import { showToast } from '@/lib/toast';
import { ShieldCheckIcon } from '@/ui/icons';
import { Check, LinkExternal01 } from '@/ui/lineIcons';
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
        // "Not now": nothing carries on, and it says so (redesign R7d, audit AU-17).
        if (!next && retry.current) {
          retry.current = null;
          showToast('AI actions stay off until you agree.', { tone: 'info' });
        }
      }}
      size="md"
    >
      {/* Scrolls on a short window instead of running off it (AU-18). */}
      <div className="flex min-h-0 flex-col overflow-y-auto">
        <DialogHero src="/illustrations/v2/ai-consent.webp" width={526} height={560} />
        <div className={cn(dialogBody, 'overflow-y-visible pt-5')}>
          <DialogHead
            title="Before NextKin uses AI"
            line="To read your documents and write new ones, NextKin sends their content to:"
          />
          {/* While it loads, the rows' shapes; if it fails, why Agree is off and a retry (AU-15). */}
          {consent.isPending && (
            <div role="status" aria-label="Loading the list" className="flex flex-col gap-2">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          )}
          {!list && consent.isError && (
            <Callout tone="warning">
              We couldn’t load who your documents go to, so you can’t agree yet.{' '}
              <button
                type="button"
                onClick={() => void consent.refetch()}
                className="font-semibold underline underline-offset-2"
              >
                Try again
              </button>
            </Callout>
          )}
          <ul className="flex flex-col gap-2">
            {list?.providers.map((p) => (
              <li key={p.name} className="flex gap-3.5 rounded-xl bg-surface-brand px-5 py-4">
                <LinkExternal01 aria-hidden className="mt-0.5 size-6 shrink-0 text-text-brand" />
                <span className="min-w-0">
                  <span className="block text-body-l font-bold text-text-primary">{p.name}</span>
                  <span className="block text-body-m font-medium text-text-secondary">
                    {p.purpose}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-2.5 text-body-l font-semibold text-success-text">
            <ShieldCheckIcon aria-hidden className="size-6 shrink-0 text-success-600" />
            Your name, email, phone and address are never sent.
          </p>
          <p className="text-body-m text-text-tertiary">
            You can change this any time in{' '}
            <Link
              href={'/settings?tab=privacy' as Route}
              className={cn(textLink, 'underline underline-offset-2')}
            >
              Privacy &amp; data
            </Link>
            .
          </p>
        </div>
      </div>
      <DialogCloseButton />
      <div className={dialogFooter}>
        <DialogClose className={buttonClass({ variant: 'secondary', size: 'lg' })}>
          Not now
        </DialogClose>
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
          className={buttonClass({ size: 'lg' })}
        >
          <Check aria-hidden className="size-5" />
          <StableLabel label="Agree and continue" busyLabel="Saving…" busy={grant.isPending} />
        </button>
      </div>
    </Dialog>
  );
}
