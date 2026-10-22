import { useEffect, useRef, useState } from 'react';

import { onConsentRequired, useAiConsent, useGrantAiConsent } from '@/data/queries';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { showAppToast } from '@/ui/Toast';

/**
 * The AI consent dialog (ImBackendImplementationPlan P12-12; V2 §8.5). Spec-derived: no artboard
 * draws it yet, so it is the existing confirm sheet in its neutral tone, and it is replaced
 * wholesale when one arrives (toreview §105.19). It opens the first time an AI action is refused
 * for want of consent, names the providers and what each does, and records agreement to that
 * version of the list. "Agree and continue" then continues: the refused mutation runs again with
 * the same input and the screen's own callbacks (`retry` from the listener, toreview §114).
 */
export function AiConsentGate() {
  const [open, setOpen] = useState(false);
  const consent = useAiConsent();
  const grant = useGrantAiConsent();
  const pending = useRef<(() => void) | null>(null);

  useEffect(
    () =>
      onConsentRequired((retry) => {
        pending.current = retry;
        setOpen(true);
      }),
    [],
  );

  const list = consent.data?.current;
  const providers = list?.providers.map((p) => `${p.name}: ${p.purpose}`).join('\n') ?? '';

  return (
    <ConfirmSheet
      open={open}
      tone="neutral"
      title="Before NextKin uses AI"
      message={`To read your documents and write new ones, NextKin sends their content to:\n${providers}\nYour name, email, phone and address are never sent.`}
      confirmLabel="Agree and continue"
      cancelLabel="Not now"
      busy={grant.isPending || !list}
      onConfirm={() => {
        if (!list) return;
        grant.mutate(list.version, {
          onSuccess: () => {
            setOpen(false);
            const next = pending.current;
            pending.current = null;
            if (next) next();
            else showAppToast('Thanks. Try that again now.', 'success');
          },
          onError: () => showAppToast('That didn’t save. Try again.', 'error'),
        });
      }}
      onCancel={() => {
        pending.current = null;
        setOpen(false);
      }}
    />
  );
}
