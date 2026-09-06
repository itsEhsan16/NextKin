import { Text } from '@/ui/Text';

export type AccountStatusLineProps = {
  message: string;
  tone?: 'neutral' | 'danger';
};

/**
 * The one line each group prints under itself once its action has been answered.
 *
 * Deliberately NOT a toast. Nothing above a pushed screen mounts a toast host — the hosts live in
 * the tab layout, and this screen sits above it in the stack — so a toast raised from here would
 * simply never render. Please do not re-add one: confirmation belongs next to the control that
 * earned it anyway, where it stays on screen long enough to be read.
 *
 * `accessibilityLiveRegion` is Android-only; the danger case is also announced by the field or
 * the button that failed, so nothing here is the only announcement of a failure.
 */
export function AccountStatusLine({ message, tone = 'neutral' }: AccountStatusLineProps) {
  return (
    <Text
      variant="caption"
      color={tone === 'danger' ? 'danger' : 'textSecondary'}
      accessibilityLiveRegion="polite"
    >
      {message}
    </Text>
  );
}
