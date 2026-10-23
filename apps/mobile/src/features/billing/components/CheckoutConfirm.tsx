import { Image } from 'expo-image';

import { useTheme } from '@/theme';
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
 *
 * BILLING 02 (580:314) opens the sheet on its own drawing: the checkout page behind a padlock.
 */
// BILLING 02's drawing (680:95) at 390, in artboard units: 223 × 124, 2 above the title.
const ART_W = 223 / 0.75;
const ART_H = 124 / 0.75;
const ART_TO_TITLE = 2 / 0.75;

export function CheckoutConfirm({ open, busy, failed, onConfirm, onCancel }: CheckoutConfirmProps) {
  const { motion, s } = useTheme();
  return (
    <ConfirmSheet
      open={open}
      tone="neutral"
      art={
        <Image
          source={require('../../../../assets/illustrations/billing/checkout.png')}
          contentFit="contain"
          transition={motion.durations.imageFade}
          cachePolicy="memory-disk"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: s(ART_W), height: s(ART_H) }}
        />
      }
      artGap={s(ART_TO_TITLE)}
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
