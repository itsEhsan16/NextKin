import { BUTTON_VARIANT } from './buttonStyles';

/**
 * Was the boards' bevelled primary (a lighter rim over a deeper face) on the AI card and the
 * sidebar's Upgrade. Retired by the owner on 2026-11-12 (redesign R3b): it now gives the one flat
 * primary from `buttonStyles`, keeping the corner and weight its two callers relied on. New code
 * uses `Button` or `buttonClass`.
 */
export const primaryButton = `${BUTTON_VARIANT.primary} rounded-sm font-semibold`;
