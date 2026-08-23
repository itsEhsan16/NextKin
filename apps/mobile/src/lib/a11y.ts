import type { AccessibilityProps, Insets } from 'react-native';

/** Expands small controls to the 44pt minimum hit target without changing layout. */
export const hitSlopFor = (size: number): Insets => {
  const pad = Math.max(0, (44 - size) / 2);
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

/** Dense chrome (tab labels, badges) must not scale unboundedly with Dynamic Type. */
export const maxFontScale = {
  chrome: 1.2,
  body: 1.6,
} as const;
