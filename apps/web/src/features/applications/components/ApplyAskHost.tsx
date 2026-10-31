'use client';

import type { ApplicationAnswer, ApplicationAsk } from '@nextkin/shared/models';
import { useAnswerApplicationAsk, useApplicationAsks } from '@nextkin/shared/queries';
import { useEffect, useRef, useState } from 'react';

import { showToast } from '@/lib/toast';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { textLink } from '@/ui/textLink';

import { useApplyAskStore } from '../applyAsk';

/**
 * The one "Did you apply?" dialog, in the app shell so it can rise over any page. It also raises a
 * question left waiting, once a visit: a run finished last time, or yesterday's "not yet". Spec-
 * derived, with no board, from the existing confirm dialog. Escape and the backdrop answer "not
 * yet": leaving the question is not the same as saying no.
 */
export function ApplyAskHost() {
  const ask = useApplyAskStore((state) => state.ask);
  const open = useApplyAskStore((state) => state.open);
  const close = useApplyAskStore((state) => state.close);
  const waiting = useApplicationAsks();
  const answerAsk = useAnswerApplicationAsk();
  const raised = useRef(false);
  // The words stay in the dialog while it animates out, after the store has let the ask go.
  const [shown, setShown] = useState<ApplicationAsk | null>(ask);
  if (ask && ask !== shown) setShown(ask);

  const first = waiting.data?.[0];
  useEffect(() => {
    if (!first || raised.current) return;
    raised.current = true;
    open(first);
  }, [first, open]);

  const answer = (value: ApplicationAnswer) => {
    if (!ask) return;
    answerAsk.mutate(
      { id: ask.id, answer: value },
      {
        onSuccess: () => {
          if (value === 'yes') showToast('Added to your applications', { tone: 'success' });
        },
      },
    );
    close();
  };

  return (
    <ConfirmDialog
      open={ask != null}
      tone="brand"
      title="Did you apply?"
      message={shown ? `${shown.title} at ${shown.company}` : ''}
      confirmLabel="Yes, I applied"
      cancelLabel="Not yet"
      onConfirm={() => answer('yes')}
      onCancel={() => answer('not_yet')}
    >
      <button type="button" onClick={() => answer('no')} className={`${textLink} self-start`}>
        I won’t apply
      </button>
    </ConfirmDialog>
  );
}
