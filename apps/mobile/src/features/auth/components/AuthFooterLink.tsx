import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { board } from '../board';
import { hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type AuthFooterLinkProps = {
  /** The greyed half — "Already have an account?", "Don't have an account?". */
  prompt: string;
  /** The half that reads as the link, set a weight heavier and in ink. */
  action: string;
  /** Drawn: the space above, the drawn text height, the word gap, and the floor under it. */
  top: number;
  height: number;
  gap: number;
  floor: number;
  onPress: () => void;
};

/**
 * The line each auth form ends on, sending the reader to the other one (307:4443 / 309:333).
 *
 * In the flow, not pinned: both boards put it a fixed distance under the last button with the
 * frame's floor beneath, and pinning it is what pushed sign-up's Google button underneath it on
 * the third device pass.
 */
export function AuthFooterLink({
  prompt,
  action,
  top,
  height,
  gap,
  floor,
  onPress,
}: AuthFooterLinkProps) {
  const { s } = useTheme();
  const styles = useStyles();
  // The board's floor covers a gesture bar; a 3-button navigation bar can be taller than it.
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      // The rows' slight press: a link that gave nothing back under the finger read as dead (§85).
      feedback="subtle"
      accessibilityRole="link"
      accessibilityLabel={`${prompt} ${action}`}
      hitSlop={hitSlopFor(s(board(height)))}
      onPress={onPress}
      style={[
        styles.footer,
        {
          marginTop: s(board(top)),
          marginBottom: Math.max(s(board(floor)), insets.bottom + s(16)),
          gap: s(board(gap)),
        },
      ]}
    >
      <Text variant="callout" color="textTertiary">
        {prompt}
      </Text>
      <Text variant="bodySemiBold" color="onboardingInk">
        {action}
      </Text>
    </Pressable>
  );
}

const useStyles = scaledSheet(() => ({
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
}));
