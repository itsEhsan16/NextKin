import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { a11yButton, haptics } from '@/lib';
import { useAppearanceStore, useTheme, type AppearancePreference } from '@/theme';
import { Screen, Text } from '@/ui';
import { DevButton, DevSection } from '@/ui/dev';

type GalleryRow = { href: Href; title: string; subtitle: string };

const ROWS: readonly GalleryRow[] = [
  { href: '/dev/tokens', title: 'Tokens', subtitle: 'Colours, spacing, radii, shadows' },
  { href: '/dev/typography', title: 'Typography', subtitle: 'Plus Jakarta Sans type ramp' },
  { href: '/dev/motion', title: 'Motion', subtitle: 'Springs, timings, stagger, meter' },
  { href: '/dev/mock', title: 'Mock data', subtitle: 'Latency / empty / error modes' },
];

const APPEARANCE: readonly { key: AppearancePreference; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

const CHEVRON_SIZE = 14;

export default function DevIndexRoute() {
  const { colors, spacing, radii, sizes, opacity, scheme } = useTheme();
  const router = useRouter();
  const preference = useAppearanceStore((s) => s.preference);
  const setPreference = useAppearanceStore((s) => s.setPreference);

  return (
    <Screen scroll edges={[]}>
      <DevSection
        title="Gallery"
        description="Phase 1 foundations. Every value comes from src/theme."
      >
        <View style={{ gap: spacing[2] }}>
          {ROWS.map((row) => (
            <Pressable
              key={row.title}
              {...a11yButton(row.title, row.subtitle)}
              onPress={() => {
                haptics.light();
                router.push(row.href);
              }}
              style={({ pressed }) => [
                styles.row,
                {
                  minHeight: sizes.listRow,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  borderRadius: radii.xl,
                  backgroundColor: colors.surfaceSubtle,
                  opacity: pressed ? opacity.pressed : 1,
                },
              ]}
            >
              <View style={[styles.rowText, { gap: spacing[1] }]}>
                <Text variant="title">{row.title}</Text>
                <Text variant="captionRegular" color="textSecondary">
                  {row.subtitle}
                </Text>
              </View>
              <FontAwesome5 name="chevron-right" size={CHEVRON_SIZE} color={colors.iconChevron} />
            </Pressable>
          ))}
        </View>
      </DevSection>

      <DevSection title="Appearance" description={`Resolved scheme: ${scheme}`}>
        <View style={[styles.segments, { gap: spacing[2] }]}>
          {APPEARANCE.map((option) => (
            <DevButton
              key={option.key}
              label={option.label}
              active={preference === option.key}
              onPress={() => setPreference(option.key)}
              grow
            />
          ))}
        </View>
      </DevSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowText: { flex: 1 },
  segments: { flexDirection: 'row' },
});
