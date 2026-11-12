import { BUTTON_VARIANT } from './buttonStyles';

/**
 * The app's secondary action beside `brandButton`: Save Job, Update Status, and the resume card's
 * Download and Use for Job. A white face with a divider-grey edge and a muted hover. A constant
 * rather than a component for the same reason `brandButton` is: height, padding, radius and type
 * stay with each caller.
 */
export const outlineButton = BUTTON_VARIANT.secondary;
