import { scaledSheet } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type AuthFooterProps = {
  prompt: string;
  action: string;
  onPress: () => void;
};

/** "Have an account? Sign in" — one tappable line under a signed-out form (§172). */
export function AuthFooter({ prompt, action, onPress }: AuthFooterProps) {
  const styles = useStyles();
  return (
    <Pressable
      feedback="subtle"
      accessibilityRole="button"
      accessibilityLabel={action}
      onPress={onPress}
      style={styles.row}
    >
      <Text variant="callout" color="textSecondary">
        {prompt}
      </Text>
      <Text variant="bodySemiBold" color="ink">
        {action}
      </Text>
    </Pressable>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: u(4),
    paddingVertical: u(14),
  },
}));
