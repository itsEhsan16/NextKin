import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { Keyboard, useWindowDimensions, type ScrollView, type View } from 'react-native';

/**
 * Scrolls a field that has just taken focus out from under the keyboard.
 *
 * `Screen`'s `keyboard` prop pads the page by the keyboard's height on both platforms, which makes
 * the field *reachable* but does not move the scroll offset. React Native's `ScrollView` does not
 * scroll to a focused `TextInput` on Android at all, and not reliably on iOS — so a field below the
 * fold stayed under the keyboard and the user typed blind. A device pass found it on
 * `/profile/edit`, where the numeric "Years of experience" is the last node on the page.
 *
 * The padding itself now comes from `react-native-keyboard-controller` (in Expo Go since SDK 57;
 * see `KeyboardFrame`). The reveal stays on React Native's own keyboard events and metrics, which
 * the 2026-10-03 device pass verified; it was never the part that snapped.
 *
 * The measurement is deliberately in window coordinates rather than relative to the scroll content.
 * `measureInWindow` needs no node handle and no `measureLayout` against a host ref, so a field can
 * sit at any depth — inside a `RowGroup`, inside a form section — without either end knowing about
 * the other.
 */

export type RevealOnFocus = (node: View | null) => void;

/**
 * Whether the keyboard has finished opening. `KeyboardController.isVisible()` turns true as the
 * keyboard *starts* to rise, so it cannot say this; React Native's `keyboardDidShow` can.
 * Module-level, like React Native's own `Keyboard.isVisible()`, so `Screen` can ask it from a
 * layout callback.
 */
let keyboardSettled = false;
Keyboard.addListener('keyboardDidShow', () => {
  keyboardSettled = true;
});
for (const moving of ['keyboardWillShow', 'keyboardWillHide', 'keyboardDidHide'] as const) {
  Keyboard.addListener(moving, () => {
    keyboardSettled = false;
  });
}

/** True once the keyboard is fully up and not moving — see `keyboardSettled`. */
export const isKeyboardSettled = (): boolean => keyboardSettled;

const RevealContext = createContext<RevealOnFocus | null>(null);

/** Breathing room between the field and the top of the keyboard, in device px. */
const MARGIN = 12;

export type RevealInput = {
  /** The field's top edge in window coordinates, and its full height. */
  fieldY: number;
  fieldHeight: number;
  /** Top edge of the keyboard in window coordinates; the window's own bottom when it is down. */
  keyboardTop: number;
  /** The pinned bar rides above the keyboard, so it occludes just as the keyboard does. */
  footerHeight: number;
  /** Where the scroller is now — the reveal is expressed as a new absolute offset. */
  scrollOffset: number;
  /**
   * Where the scroll viewport starts in the window. A field above it is under the pinned header,
   * as hidden as one under the keyboard, so the page scrolls back to show it.
   */
  viewportTop?: number;
};

/**
 * Where the scroller must go for the field to clear the keyboard, or `null` to leave it alone.
 *
 * Pure, and separated from the measuring so it can be tested without a layout engine — the same
 * split as `sheetKeyboardMath`, `monthYearMath` and `swipeMath`. Jest performs no layout, so a
 * component test could only have asserted that *something* was called; this asserts the arithmetic.
 */
export function revealTarget({
  fieldY,
  fieldHeight,
  keyboardTop,
  footerHeight,
  scrollOffset,
  viewportTop,
}: RevealInput): number | null {
  // A field tucked under the pinned header scrolls back into view, top edge first.
  if (viewportTop != null && fieldY < viewportTop + MARGIN) {
    return Math.max(0, scrollOffset - (viewportTop + MARGIN - fieldY));
  }
  const visibleBottom = keyboardTop - footerHeight - MARGIN;
  const fieldBottom = fieldY + fieldHeight;
  // Otherwise it only ever scrolls DOWN to uncover a field. Pulling a field that is merely high on
  // the page back to the keyboard's edge would yank the page about while someone tabs through it.
  if (fieldBottom <= visibleBottom) return null;
  return Math.max(0, scrollOffset + (fieldBottom - visibleBottom));
}

export type RevealProviderProps = {
  scrollRef: RefObject<ScrollView | null>;
  /** Live scroll offset — the provider needs it to convert a window delta into a target offset. */
  getOffset: () => number;
  /** Height of the pinned footer, which rides above the keyboard and hides the field behind it. */
  footerRef: RefObject<number>;
  /** The scroll viewport's top edge in the window (under the safe area and the pinned header). */
  viewportTopRef?: RefObject<number>;
  /** Filled with the reveal, so the page can re-run it once the keyboard has resized it. */
  revealAgainRef?: RefObject<(() => void) | null>;
  enabled: boolean;
  children: ReactNode;
};

export function RevealProvider({
  scrollRef,
  getOffset,
  footerRef,
  viewportTopRef,
  revealAgainRef,
  enabled,
  children,
}: RevealProviderProps) {
  const { height: windowHeight } = useWindowDimensions();
  /** The field waiting to be revealed. Held because focus usually precedes the keyboard. */
  const pending = useRef<View | null>(null);

  const run = useCallback(() => {
    const node = pending.current;
    if (!node || !scrollRef.current) return;

    // `metrics()` is the last known keyboard frame, so this is right both when focus arrives
    // before the keyboard and when the keyboard is already up and focus moves between fields.
    const metrics = Keyboard.metrics();
    const keyboardTop = metrics ? metrics.screenY : windowHeight;

    node.measureInWindow((_x, y, _width, height) => {
      const target = revealTarget({
        fieldY: y,
        fieldHeight: height,
        keyboardTop,
        footerHeight: footerRef.current,
        scrollOffset: getOffset(),
        viewportTop: viewportTopRef?.current,
      });
      if (target != null) scrollRef.current?.scrollTo({ y: target, animated: true });
    });
  }, [footerRef, getOffset, scrollRef, viewportTopRef, windowHeight]);

  useEffect(() => {
    if (!revealAgainRef) return undefined;
    revealAgainRef.current = enabled ? run : null;
    return () => {
      revealAgainRef.current = null;
    };
  }, [enabled, revealAgainRef, run]);

  useEffect(() => {
    if (!enabled) return undefined;
    // Both events: `didShow` covers the first field focused on a page, `didChangeFrame` covers a
    // keyboard that resizes under it (a suggestion strip appearing, a switch to a numeric pad).
    const shown = Keyboard.addListener('keyboardDidShow', run);
    const changed = Keyboard.addListener('keyboardDidChangeFrame', run);
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      pending.current = null;
    });
    return () => {
      shown.remove();
      changed.remove();
      hidden.remove();
    };
  }, [enabled, run]);

  const reveal = useCallback<RevealOnFocus>(
    (node) => {
      pending.current = node;
      // If the keyboard is already up there will be no `didShow` to wait for.
      if (Keyboard.isVisible()) run();
    },
    [run],
  );

  const value = useMemo(() => (enabled ? reveal : null), [enabled, reveal]);

  return <RevealContext.Provider value={value}>{children}</RevealContext.Provider>;
}

/**
 * Handed to every field that can take focus. Returns `null` outside a keyboard-aware scrolling
 * `Screen` — in a sheet, or on a static page — and the field then does nothing, which is correct:
 * a sheet does its own lifting.
 */
export const useRevealOnFocus = (): RevealOnFocus | null => useContext(RevealContext);
