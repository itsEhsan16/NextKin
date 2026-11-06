import { ConfirmSheet } from '@/ui/ConfirmSheet';

import { useAccuracyStore } from '../accuracyStore';

export const ACCURACY_TITLE = 'Is everything here true?';
export const ACCURACY_MESSAGE = 'Check every role, date, skill and number before you download.';
export const ACCURACY_CONFIRM = 'Yes, it’s accurate';
export const ACCURACY_CANCEL = 'Not yet';

/**
 * The one accuracy confirmation sheet (V2 §15 risk 2), mounted once at the root so it rises above
 * the tabs, the editor and a finished run alike. Cancel, the scrim and Android back answer "not
 * yet", and the export stops without a file.
 */
export function AccuracyConfirmHost() {
  const open = useAccuracyStore((state) => state.open);
  const answer = useAccuracyStore((state) => state.answer);
  return (
    <ConfirmSheet
      open={open}
      tone="neutral"
      title={ACCURACY_TITLE}
      message={ACCURACY_MESSAGE}
      confirmLabel={ACCURACY_CONFIRM}
      cancelLabel={ACCURACY_CANCEL}
      onConfirm={() => answer(true)}
      onCancel={() => answer(false)}
    />
  );
}
