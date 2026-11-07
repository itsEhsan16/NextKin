import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics, useReducedMotion } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { Icon, type LineIconName } from '@/ui/Icon';
import { Text } from '@/ui/Text';

/** What a toast reports: something done, something that failed, or plain news. */
export type ToastTone = 'success' | 'error' | 'info';

export type ToastProps = {
  visible: boolean;
  message: string;
  /**
   * `error` leads with a red "!" and buzzes; `success` and `info` show the brand dot only.
   */
  tone?: ToastTone;
  /** Overrides the tone's glyph. */
  icon?: LineIconName;
  /** Auto-dismiss delay. The caller owns `visible`; this just asks it to flip. */
  durationMs?: number;
  onHide: () => void;
};

/**
 * Only a failure carries a glyph: "done" and "news" are said in words alone (owner, 2026-11-08,
 * §190: no green tick). A failure keeps its red mark so it never reads as done.
 */
const TONE_GLYPH: Partial<Record<ToastTone, { icon: LineIconName; color: ColorToken }>> = {
  error: { icon: 'AlertCircle', color: 'danger' },
};

/** Lifted clear of the floating tab bar and of a screen's pinned footer (the chat bar). */
const BOTTOM_LIFT = 104;

/**
 * Transient confirmation (redrawn 2026-11-08, §190): a small white pill in the bottom-right corner,
 * the app's card look (soft lift, hairline edge) with a brand dot, up to two lines. It rises in and
 * drops away; announced politely to screen readers; it dismisses itself, so it never traps focus.
 */
export function Toast({
  visible,
  message,
  tone = 'success',
  icon,
  durationMs = 3000,
  onHide,
}: ToastProps) {
  const { colors, motion, shadows, sizes, zIndex, u } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const glyph = icon
    ? { icon, color: (tone === 'error' ? 'danger' : 'brand') as ColorToken }
    : TONE_GLYPH[tone];

  // The latest `onHide`, read when the timer fires. Hosts pass it inline, so as a dependency it
  // restarted the timer on every parent render — and a host re-rendering every progress tick
  // (the run screens) kept its toast up for good.
  const onHideRef = useRef(onHide);
  useEffect(() => {
    onHideRef.current = onHide;
  });

  // A failure is felt as well as read: one error buzz per failure shown.
  useEffect(() => {
    if (visible && tone === 'error') haptics.error();
  }, [message, tone, visible]);

  // A new message restarts the clock, so it gets its full time on screen.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => onHideRef.current(), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, message, visible]);

  return (
    // Always mounted, so hiding removes only the bar and its exit animation plays from here.
    <View
      pointerEvents="none"
      style={[
        styles.overlay,
        { bottom: insets.bottom + u(BOTTOM_LIFT), paddingHorizontal: u(16), zIndex: zIndex.toast },
      ]}
    >
      {visible ? (
        <Animated.View
          // Keyed on the message: a second toast while one shows replaces it — the old bar leaves,
          // the new one arrives — instead of the text changing under a bar that never moved.
          key={message}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          entering={reduced ? undefined : FadeInUp.duration(motion.durations.base)}
          exiting={reduced ? undefined : FadeOutDown.duration(motion.durations.fast)}
          style={[
            styles.bar,
            shadows.soft,
            {
              maxWidth: u(300),
              minHeight: u(40),
              gap: u(8),
              borderRadius: u(999),
              borderWidth: sizes.border,
              borderColor: colors.borderSoft,
              backgroundColor: colors.surfaceCard,
              paddingLeft: u(14),
              paddingRight: u(16),
              paddingVertical: u(9),
            },
          ]}
        >
          {glyph ? (
            <Icon name={icon ?? glyph.icon} size="xs" color={colors[glyph.color]} />
          ) : (
            <View
              style={{
                width: u(8),
                height: u(8),
                borderRadius: u(4),
                backgroundColor: colors.brand,
              }}
            />
          )}
          <Text variant="footnote" color="ink" numberOfLines={2} style={styles.label}>
            {message}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, right: 0, alignItems: 'flex-end' },
  bar: { flexDirection: 'row', alignItems: 'center' },
  label: { flexShrink: 1 },
});
