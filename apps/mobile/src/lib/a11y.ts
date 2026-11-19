import type { AccessibilityProps, Insets } from 'react-native';

/**
 * Expands small controls to the 44pt minimum hit target without changing layout.
 *
 * `size` is the control's DEVICE-space size — what it actually renders at, i.e. `s(RAW)`. The 44
 * is `sizes.minHitTarget`, a platform floor that is exempt from artboard scaling, so passing a
 * raw artboard length here silently under-pads: the slop is computed against a control bigger
 * than the one on screen, and the target lands short of 44.
 */
export const hitSlopFor = (size: number): Insets => {
  // 48dp, Android's touch-target guidance (and above iOS's 44pt): invisible, so the look holds.
  const pad = Math.max(0, (48 - size) / 2);
  return { top: pad, bottom: pad, left: pad, right: pad };
};

export const hitSlop8: Insets = { top: 8, bottom: 8, left: 8, right: 8 };

export const a11yButton = (label: string, hint?: string): AccessibilityProps => ({
  accessible: true,
  accessibilityRole: 'button',
  accessibilityLabel: label,
  ...(hint ? { accessibilityHint: hint } : {}),
});

export const a11yHeader = (label?: string): AccessibilityProps => ({
  accessibilityRole: 'header',
  ...(label ? { accessibilityLabel: label } : {}),
});

/**
 * Hides a copy that is fully transparent — one of two stacked labels that cross-fade on a state
 * change — so assistive tech and test queries see only the copy that is showing.
 */
export const a11yHiddenWhen = (hidden: boolean): AccessibilityProps | null =>
  hidden
    ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' }
    : null;

/**
 * Caps on the OS font-size setting, which multiplies every size on top of the artboard scale.
 * The screens are proportional replicas of a 520px frame, so letting text grow 60% past its
 * designed size is what reintroduces the wrapping and truncation the scaling exists to prevent.
 * Chrome is pinned outright. Body follows the phone up to 1.3: someone who set their text to
 * 130% or more must get noticeably bigger text (owner, 2026-11-20), and the boxes that held body
 * text at a fixed height grow with it (Button, FeatureRows) instead of clipping.
 */
export const maxFontScale = {
  chrome: 1,
  body: 1.3,
} as const;
