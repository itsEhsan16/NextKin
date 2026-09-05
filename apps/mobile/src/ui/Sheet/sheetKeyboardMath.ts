/**
 * How far an open Sheet rises for the keyboard. Pure, and unit-tested directly — the keyboard
 * cannot be raised in the test renderer, the same reason `swipeMath` and `rangeMath` exist.
 */

export type KeyboardLiftInput = {
  keyboardHeight: number;
  sheetHeight: number;
  insetBottom: number;
  insetTop: number;
  windowHeight: number;
};

/**
 * How far an open sheet rises for the keyboard: its height above the home indicator, capped so
 * the sheet's top never passes the top inset. A worklet - it is read on the UI thread.
 *
 * The `Number.isFinite` guard is load-bearing, not defensive noise: Reanimated's jest mock
 * returns `useAnimatedKeyboard()` as `{ height: 0 }` — a plain number rather than a shared
 * value — so `keyboard.height.value` is `undefined` under test. Without the guard that becomes
 * a NaN translateY and every sheet test carrying the lift fails on style validation.
 */
export function keyboardLift(i: KeyboardLiftInput): number {
  'worklet';
  const kb = Number.isFinite(i.keyboardHeight) ? i.keyboardHeight : 0;
  const wanted = Math.max(0, kb - i.insetBottom);
  const room = Math.max(0, i.windowHeight - i.insetTop - i.sheetHeight);
  return Math.min(wanted, room);
}
