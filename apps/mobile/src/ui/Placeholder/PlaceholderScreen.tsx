import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { a11yHeader } from '@/lib';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export type PlaceholderScreenProps = {
  title: string;
  /** The build phase in which the real screen lands. */
  phase: number;
  /** Figma screen names this route will implement. */
  figmaScreens: readonly string[];
  /** Optional extra content rendered under the Figma list (e.g. a data-layer smoke test). */
  children?: ReactNode;
};

/** Temporary tab content while the real screens are built out phase by phase. */
export function PlaceholderScreen({
  title,
  phase,
  figmaScreens,
  children,
}: PlaceholderScreenProps) {
  const { colors, spacing, radii } = useTheme();

  return (
    <Screen scroll tabBarInset>
      <View style={{ paddingTop: spacing[8], gap: spacing[2] }}>
        <Text {...a11yHeader()} variant="displayLg">
          {title}
        </Text>
        <Text variant="bodyMedium" color="brand">
          Coming in Phase {phase}
        </Text>
      </View>

      <View
        style={[
          styles.card,
          {
            marginTop: spacing[6],
            padding: spacing[4],
            gap: spacing[2],
            borderRadius: radii.card,
            backgroundColor: colors.surfaceSubtle,
          },
        ]}
      >
        <Text variant="captionSemiBold" color="textSecondary">
          Figma screens
        </Text>
        {figmaScreens.map((name) => (
          <Text key={name} variant="body" color="textBody">
            {'•'} {name}
          </Text>
        ))}
      </View>

      {children ? <View style={{ marginTop: spacing[6] }}>{children}</View> : null}

      {__DEV__ ? (
        <Link href="/dev" style={{ marginTop: spacing[8] }}>
          <Text variant="bodySemiBold" color="brand">
            Open dev gallery
          </Text>
        </Link>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch' },
});
