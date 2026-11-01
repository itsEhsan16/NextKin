import { useState } from 'react';

import type { ApplicationAnswer, ApplicationAsk } from '@/data/models';
import { useAnswerApplicationAsk } from '@/data/queries';
// Deep import on purpose: the notifications barrel drags its screens in. This is plain.
import {
  offerPush,
  primerTitleForApplication,
} from '@/features/notifications/components/PushPrimerSheet';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { showAppToast } from '@/ui/Toast';

import { useApplyAskStore } from '../applyAskStore';

export const APPLY_ASK_TITLE = 'Did you apply?';
export const APPLY_ASK_YES = 'Yes, I applied';
export const APPLY_ASK_NOT_YET = 'Not yet';
export const APPLY_ASK_NO = 'I won’t apply';
export const APPLY_ASK_SAVED = 'Added to your applications';

export const applyAskMessage = (ask: Pick<ApplicationAsk, 'title' | 'company'>): string =>
  `${ask.title} at ${ask.company}`;

/**
 * The one "Did you apply?" sheet, mounted at the root so it rises above any screen. No artboard
 * draws it, so it is built from the existing confirm sheet (rule 7). The scrim and Android back
 * answer "not yet": leaving the question is not the same as saying no.
 */
export function ApplyAskHost() {
  const ask = useApplyAskStore((state) => state.ask);
  const close = useApplyAskStore((state) => state.close);
  const answerAsk = useAnswerApplicationAsk();
  // The text stays on the sheet while it slides away, after the store has let the ask go.
  const [shown, setShown] = useState<ApplicationAsk | null>(ask);
  if (ask && ask !== shown) setShown(ask);

  const answer = (value: ApplicationAnswer) => {
    if (!ask) return;
    answerAsk.mutate(
      { id: ask.id, answer: value },
      {
        onSuccess: () => {
          if (value !== 'yes') return;
          showAppToast(APPLY_ASK_SAVED);
          void offerPush(primerTitleForApplication(ask.company));
        },
      },
    );
    close();
  };

  return (
    <ConfirmSheet
      open={ask != null}
      tone="neutral"
      title={APPLY_ASK_TITLE}
      message={shown ? applyAskMessage(shown) : ''}
      confirmLabel={APPLY_ASK_YES}
      cancelLabel={APPLY_ASK_NOT_YET}
      extraLabel={APPLY_ASK_NO}
      onConfirm={() => answer('yes')}
      onCancel={() => answer('not_yet')}
      onExtra={() => answer('no')}
    />
  );
}
