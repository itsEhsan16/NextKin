import { StyleSheet, View } from 'react-native';

import { useTheme, type ColorToken } from '@/theme';
import { Screen, Text } from '@/ui';
import { DevSection } from '@/ui/dev';

const SWATCH = 44;
const BAR_HEIGHT = 12;
const RADIUS_BOX = 56;
const SHADOW_CARD_HEIGHT = 72;

export default function TokensRoute() {
  const { scheme, colors, spacing, radii, shadows, sizes } = useTheme();

  const colorEntries = Object.entries(colors) as [ColorToken, string][];
  const spacingEntries = Object.entries(spacing) as [string, number][];
  const radiiEntries = Object.entries(radii) as [string, number][];
  const shadowEntries = Object.entries(shadows) as [string, object][];

  return (
    <Screen scroll edges={[]}>
      <DevSection title="Colours" description={`${colorEntries.length} roles · ${scheme} scheme`}>
        <View style={{ gap: spacing[2] }}>
          {colorEntries.map(([name, value]) => (
            <View key={name} style={[styles.row, { gap: spacing[3] }]}>
              <View
                style={{
                  width: SWATCH,
                  height: SWATCH,
                  borderRadius: radii.md,
                  backgroundColor: value,
                  borderWidth: 1,
                  borderColor: colors.borderHairline,
                }}
              />
              <View style={styles.grow}>
                <Text variant="bodyMedium">{name}</Text>
                <Text variant="captionRegular" color="textSecondary">
                  {value}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </DevSection>

      <DevSection title="Spacing" description="4-pt scale; gutter is the screen padding">
        <View style={{ gap: spacing[2] }}>
          {spacingEntries.map(([name, value]) => (
            <View key={name} style={[styles.row, { gap: spacing[3] }]}>
              <Text variant="caption" color="textSecondary" style={styles.key}>
                {name}
              </Text>
              <View
                style={{
                  width: Math.max(value, 1),
                  height: BAR_HEIGHT,
                  borderRadius: radii.xs,
                  backgroundColor: colors.brand,
                }}
              />
              <Text variant="captionRegular" color="textTertiary">
                {value}
              </Text>
            </View>
          ))}
        </View>
      </DevSection>

      <DevSection title="Radii">
        <View style={[styles.wrap, { gap: spacing[3] }]}>
          {radiiEntries.map(([name, value]) => (
            <View key={name} style={[styles.center, { gap: spacing[1] }]}>
              <View
                style={{
                  width: RADIUS_BOX,
                  height: RADIUS_BOX,
                  borderRadius: value,
                  backgroundColor: colors.brandSurface,
                  borderWidth: 1,
                  borderColor: colors.brandBorder,
                }}
              />
              <Text variant="micro" color="textSecondary">
                {name} · {value}
              </Text>
            </View>
          ))}
        </View>
      </DevSection>

      <DevSection title="Shadows" description="boxShadow on both platforms; elevation on Android">
        <View style={{ gap: spacing[5] }}>
          {shadowEntries.map(([name, style]) => (
            <View
              key={name}
              style={[
                styles.center,
                {
                  height: SHADOW_CARD_HEIGHT,
                  borderRadius: radii.card,
                  backgroundColor: colors.surfaceCard,
                },
                style,
              ]}
            >
              <Text variant="bodyMedium">{name}</Text>
            </View>
          ))}
        </View>
      </DevSection>

      <DevSection title="Sizes">
        <View style={{ gap: spacing[1] }}>
          {(Object.entries(sizes) as [string, number][]).map(([name, value]) => (
            <View key={name} style={[styles.row, styles.between]}>
              <Text variant="captionRegular" color="textBody">
                {name}
              </Text>
              <Text variant="caption" color="textSecondary">
                {value}
              </Text>
            </View>
          ))}
        </View>
      </DevSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
  grow: { flex: 1 },
  key: { width: 56 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
