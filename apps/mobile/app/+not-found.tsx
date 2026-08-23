import { Link } from 'expo-router';
import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Screen, Text } from '@/ui';

export default function NotFoundRoute() {
  const { spacing } = useTheme();

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing[3] }}>
        <Text variant="display">Page not found</Text>
        <Text variant="body" color="textSecondary">
          The link you followed does not match any screen.
        </Text>
        <Link href="/" style={{ marginTop: spacing[4] }}>
          <Text variant="bodySemiBold" color="brand">
            Go to Home
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
