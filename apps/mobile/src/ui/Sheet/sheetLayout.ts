/**
 * Layout maths and the host a11y contract for `Sheet`, split out of Sheet.tsx when the keyboard
 * lift pushed it past the file-size guideline. Pure — no React, no theme.
 */
import type { AccessibilityProps } from 'react-native';

/**
 * Modal-isolation contract for sheet hosts.
 *
 * accessibilityViewIsModal only hides the *siblings* of the view that sets it, and Android
 * ignores it outright — so the Sheet alone cannot make the screen behind it inert for a
 * screen reader. The Sheet marks its own overlay root modal (which covers iOS whenever the
 * sheet is mounted alongside the page content); the host must additionally spread these props
 * onto the background subtree it owns — the tabs layout's screen container — while the sheet
 * is open, or that content stays swipe-navigable under the sheet on Android.
 *
 * Usage: spread onto the background wrapper, e.g.
 * <View {...sheetBackgroundA11yProps(sheetOpen)}>{screens}</View>, with the Sheet rendered as
 * a sibling after it.
 */
export function sheetBackgroundA11yProps(
  sheetOpen: boolean,
): Pick<AccessibilityProps, 'accessibilityElementsHidden' | 'importantForAccessibility'> {
  return sheetOpen
    ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' }
    : { accessibilityElementsHidden: false, importantForAccessibility: 'auto' };
}

export type SheetHeightInput = {
  /** The artboard height for this sheet, excluding safe-area insets. */
  designHeight: number;
  /** Measured height of the sheet's own content column; 0 before the first layout pass. */
  contentHeight: number;
  insetBottom: number;
  insetTop: number;
  windowHeight: number;
};

/**
 * The design height is a FLOOR, not a fixed size.
 *
 * Figma artboards are 520pt wide; on a narrower phone the sheet's text wraps and the row stack
 * outgrows the scaled artboard height. Because the sheet clips (overflow: 'hidden'), a fixed
 * height would silently cut the last row off — and a clipped row is untappable on Android. So
 * the sheet takes whichever is taller, and never exceeds the screen below the top inset.
 */
export function resolveSheetHeight({
  designHeight,
  contentHeight,
  insetBottom,
  insetTop,
  windowHeight,
}: SheetHeightInput): number {
  const maxHeight = windowHeight - insetTop;
  const wanted = Math.max(designHeight, contentHeight) + insetBottom;
  return Math.min(maxHeight, wanted);
}
