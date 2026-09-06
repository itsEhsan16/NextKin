import { ConfirmSheet } from '@/ui/ConfirmSheet';

import {
  CHECKOUT_CANCEL,
  CHECKOUT_CONFIRM,
  CHECKOUT_FAILED,
  CHECKOUT_MESSAGE,
  CHECKOUT_RETRY,
  CHECKOUT_TITLE,
} from '../upgradeCopy';

export type CheckoutConfirmProps = {
  open: boolean;
  busy: boolean;
  /** The last attempt came back refused; nothing was charged. */
  failed: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * The one thing standing between the CTA and a charge. V2 §13.4 / §15 make the web the purchase
 * surface, so this says where the money is actually taken before the app hands the reader over.
 *
 * A refusal replaces the explanation with the reason and turns the button into the retry: the
 * press is never left looking as though it went through, and the control never goes dead.
 */
export function CheckoutConfirm({ open, busy, failed, onConfirm, onCancel }: CheckoutConfirmProps) {
  return (
    <ConfirmSheet
      open={open}
      tone="neutral"
      title={CHECKOUT_TITLE}
      message={failed ? CHECKOUT_FAILED : CHECKOUT_MESSAGE}
      confirmLabel={failed ? CHECKOUT_RETRY : CHECKOUT_CONFIRM}
      cancelLabel={CHECKOUT_CANCEL}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
