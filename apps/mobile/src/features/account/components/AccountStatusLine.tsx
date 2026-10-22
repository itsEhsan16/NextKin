import Animated from 'react-native-reanimated';

import { Text } from '@/ui/Text';
import { useShake } from '@/ui/motion';

export type AccountStatusLineProps = {
  message: string;
  tone?: 'neutral' | 'danger';
};

/**
 * The one line each group prints under itself once its action has been answered.
 *
 * Deliberately NOT a toast. One would render now — §85 mounted an app-wide host above every
 * screen — but confirmation belongs next to the control that earned it, where it stays on screen
 * long enough to be read. Please do not move these into one.
 *
 * A refusal nudges once as it arrives, the way the bars' failure notes do (§85); a confirmation
 * stays still. `accessibilityLiveRegion` is Android-only; the danger case is also announced by the
 * field or the button that failed, so nothing here is the only announcement of a failure.
 */
export function AccountStatusLine({ message, tone = 'neutral' }: AccountStatusLineProps) {
  const danger = tone === 'danger';
  const nudge = useShake(danger ? message : null);

  return (
    <Animated.View style={danger ? nudge : null}>
      <Text
        variant="caption"
        color={danger ? 'danger' : 'textSecondary'}
        accessibilityLiveRegion="polite"
      >
        {message}
      </Text>
    </Animated.View>
  );
}
