import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

const safe = (fn: () => Promise<void>) => {
  if (!supported) return;
  fn().catch(() => {
    // Haptics are decorative; never surface errors.
  });
};

/**
 * Semantic haptic vocabulary. Components call these by intent so the
 * feel stays consistent across the app (and silent on web / unsupported devices).
 */
export const haptics = {
  /** Sheet open, bookmark toggle, swipe threshold. */
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** Segmented control / picker selection changes. */
  selection: () => safe(() => Haptics.selectionAsync()),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Destructive confirms. */
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
