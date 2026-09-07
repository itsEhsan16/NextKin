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
 * `Screen`'s `keyboard` prop buys two things and neither of them is this one: `KeyboardAvoidingView`
 * pads the page on iOS, and Android's `windowSoftInputMode: resize` shrinks the window. Both make
 * the field *reachable*; neither moves the scroll offset. React Native's `ScrollView` does not
 * scroll to a focused `TextInput` on Android at all, and not reliably on iOS — so a field below the
 * fold stayed under the keyboard and the user typed blind. A device pass found it on
 * `/profile/edit`, where the numeric "Years of experience" is the last node on the page.
 *
 * Pure JS on purpose: `react-native-keyboard-controller` and friends are native modules, and this
 * app must run in Expo Go (CLAUDE.md rule 1).
 *
 * The measurement is deliberately in window coordinates rather than relative to the scroll content.
 * `measureInWindow` needs no node handle and no `measureLayout` against a host ref, so a field can
 * sit at any depth — inside a `RowGroup`, inside a form section — without either end knowing about
 * the other.
 */

export type RevealOnFocus = (node: View | null) => void;

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
}: RevealInput): number | null {
  const visibleBottom = keyboardTop - footerHeight - MARGIN;
  const fieldBottom = fieldY + fieldHeight;
  // Only ever scrolls DOWN to uncover a field. Pulling a field that is merely high on the page
  // back to the keyboard's edge would yank the page about while someone tabs through a form.
  if (fieldBottom <= visibleBottom) return null;
  return Math.max(0, scrollOffset + (fieldBottom - visibleBottom));
}

export type RevealProviderProps = {
  scrollRef: RefObject<ScrollView | null>;
  /** Live scroll offset — the provider needs it to convert a window delta into a target offset. */
  offsetRef: RefObject<number>;
  /** Height of the pinned footer, which rides above the keyboard and hides the field behind it. */
  footerRef: RefObject<number>;
  enabled: boolean;
  children: ReactNode;
};

export function RevealProvider({
  scrollRef,
  offsetRef,
  footerRef,
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
        scrollOffset: offsetRef.current,
      });
      if (target != null) scrollRef.current?.scrollTo({ y: target, animated: true });
    });
  }, [footerRef, offsetRef, scrollRef, windowHeight]);

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
