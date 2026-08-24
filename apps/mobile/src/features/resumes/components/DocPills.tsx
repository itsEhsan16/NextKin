import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Resume } from '@/data/models';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

import { docPillLabel, docPillTone } from '../docMeta';

export type DocTypePillProps = {
  resume: Resume;
  style?: StyleProp<ViewStyle>;
};

/**
 * "Base" (ink), "Tailored · Stripe" (grey) or "Cover letter" (brand tint) — the type pill in
 * every card footer (Figma 1:1422 / 1:1450 / 1:1496). Decorative: the card folds its copy into
 * the card-level accessibility label.
 */
export function DocTypePill({ resume, style }: DocTypePillProps) {
  const { colors, radii } = useTheme();
  const tone = docPillTone(resume);

  const surface =
    tone === 'base'
      ? colors.surfaceSelected
      : tone === 'cover'
        ? colors.brandSurface
        : colors.surfaceSubtle;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.pill, { borderRadius: radii.full, backgroundColor: surface }, style]}
    >
      <Text
        variant={tone === 'base' ? 'microBadge' : 'micro'}
        color={tone === 'base' ? 'textOnBrand' : tone === 'cover' ? 'brand' : 'textBody'}
        numberOfLines={1}
      >
        {docPillLabel(resume)}
      </Text>
    </View>
  );
}

const REFRESH_ICON = 8;

/** Amber "Update available" pill overlaid on stale documents (Figma 1:1440). */
export function UpdateAvailablePill({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.pill,
        {
          gap: spacing[1] + 1,
          borderRadius: radii.full,
          backgroundColor: colors.warningSurface,
        },
        style,
      ]}
    >
      <FontAwesome5 name="sync-alt" size={REFRESH_ICON} color={colors.warningStrong} solid />
      <Text variant="microBadge" color="warningStrong" numberOfLines={1}>
        Update available
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});
