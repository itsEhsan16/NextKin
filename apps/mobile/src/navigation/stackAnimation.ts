import { useReducedMotion } from '@/lib';

/**
 * The push every stack in the app uses. `ios_from_right` is the iOS parallax push (the screen
 * underneath drifts and dims); iOS draws it natively, and on Android it replaces the flat
 * `slide_from_right`, so both platforms move the same way (owner, 2026-10-05). Under Reduce
 * Motion the push becomes a cross-fade — how iOS itself replaces slides when the setting is on.
 */
export function useStackAnimation(): 'ios_from_right' | 'fade' {
  return useReducedMotion() ? 'fade' : 'ios_from_right';
}
