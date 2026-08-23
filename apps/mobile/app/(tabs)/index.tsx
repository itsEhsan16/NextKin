import { ActivityIndicator, View } from 'react-native';

import { useCurrentUser } from '@/data/queries';
import { useTheme } from '@/theme';
import { PlaceholderScreen, Text } from '@/ui';

/** Proves the query layer wires end to end: fixtures → repo → hook → screen. */
function HomeGreeting() {
  const { colors, spacing } = useTheme();
  const { data, isPending, isError } = useCurrentUser();

  if (isPending) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
        <ActivityIndicator color={colors.brand} />
        <Text variant="caption" color="textSecondary">
          Loading your profile…
        </Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <Text variant="caption" color="danger">
        Could not load your profile.
      </Text>
    );
  }

  return <Text variant="headline">Hi {data.firstName}</Text>;
}

export default function HomeRoute() {
  return (
    <PlaceholderScreen
      title="Home"
      phase={3}
      figmaScreens={[
        'Home',
        'Home – Notifications',
        'Create sheet (step 1)',
        'Create sheet (step 2)',
      ]}
    >
      <HomeGreeting />
    </PlaceholderScreen>
  );
}
