import { keyboardLift } from '@/ui/Sheet';

/** iPhone 14 metrics, the frame every sheet test uses. */
const base = { insetBottom: 34, insetTop: 47, windowHeight: 844 };

/** The iOS keyboard with the QuickType bar, measured from the bottom of the window. */
const KEYBOARD = 336;

describe('keyboardLift', () => {
  it('stays put while the keyboard is closed', () => {
    expect(keyboardLift({ ...base, keyboardHeight: 0, sheetHeight: 320 })).toBe(0);
  });

  it('rises by the keyboard height above the home indicator', () => {
    // The sheet already pads its own bottom inset, so only the 302pt above it has to be cleared.
    expect(keyboardLift({ ...base, keyboardHeight: KEYBOARD, sheetHeight: 320 })).toBe(302);
  });

  it('stops before a tall sheet clears the top inset', () => {
    // 844 - 47 - 700 leaves 97pt of room; the field stays partly covered rather than the sheet
    // sliding out from under the notch.
    expect(keyboardLift({ ...base, keyboardHeight: KEYBOARD, sheetHeight: 700 })).toBe(97);
  });

  it('never returns a negative lift for a keyboard shorter than the inset', () => {
    expect(keyboardLift({ ...base, keyboardHeight: 20, sheetHeight: 320 })).toBe(0);
  });

  it('treats a non-finite height as closed', () => {
    // Reanimated's jest mock returns useAnimatedKeyboard() as { height: 0 } — a plain number —
    // so `keyboard.height.value` is undefined under test. Without the guard this is NaN.
    expect(
      keyboardLift({ ...base, keyboardHeight: undefined as unknown as number, sheetHeight: 320 }),
    ).toBe(0);
  });
});
