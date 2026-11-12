import { BUTTON_VARIANT } from './buttonStyles';

/**
 * The brand-tinted outline action: the Account cards' "Edit" (307:3519) and the Settings cards'
 * "Edit", "Change password", "Enable" and "View all" (254:493-565). A white face with the lavender
 * `border-brand-strong` edge and brand ink, washed in brand on hover. A constant rather than a
 * component for the same reason `outlineButton` is: height, padding, radius and type stay with
 * each caller.
 */
export const brandOutlineButton = BUTTON_VARIANT['brand-secondary'];
