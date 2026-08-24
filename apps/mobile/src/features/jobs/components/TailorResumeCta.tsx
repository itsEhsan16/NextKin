import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';

import { a11yButton } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type TailorResumeCtaProps = { onPress: () => void };

const TILE = 44;

/** The brand-tinted "Tailor resume to this job" row (Figma 1:869) — the screen's AI entry point. */
export function TailorResumeCta({ onPress }: TailorResumeCtaProps) {
  const { colors, radii, spacing } = useTheme();

  return (
    <Pressable
      {...a11yButton(
        'Tailor resume to this job',
        'Creates a linked variant; match updates live',
      )}
      feedback="scale"
      haptic="light"
      onPress={onPress}
      style={[
        styles.row,
        {
          gap: spacing[4],
          padding: 17,
          borderRadius: radii.card,
          backgroundColor: colors.brandSurface,
          borderWidth: 1,
          borderColor: colors.brandBorder,
        },
      ]}
    >
      <View
        style={[
          styles.tile,
          { width: TILE, height: TILE, borderRadius: radii.lg, backgroundColor: colors.surfaceCard },
        ]}
      >
        <FontAwesome5 name="magic" size={17} color={colors.brand} solid />
      </View>
      <View style={styles.copy}>
        <Text variant="label" color="brand">
          Tailor resume to this job
        </Text>
        <Text variant="microSemiBold" color="textSecondary">
          Creates a linked variant · match updates live
        </Text>
      </View>
      <FontAwesome5 name="chevron-right" size={14} color={colors.brand} solid />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  tile: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
});
