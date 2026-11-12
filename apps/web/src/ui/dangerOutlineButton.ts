import { BUTTON_VARIANT } from './buttonStyles';

/**
 * The destructive outline action: Privacy & data's "Delete my data". A white face with a soft red
 * edge and red ink, washed in the danger tint on hover, beside `outlineButton` and
 * `brandOutlineButton`. On that tint the ink darkens, since the danger red alone is under 4:1
 * there. A constant rather than a component for the same reason they are.
 */
export const dangerOutlineButton = BUTTON_VARIANT['danger-secondary'];
