import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { Resume } from '@/data/models';
import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

import { docPillLabel, docPillTone } from '../docMeta';
import { Icon } from '@/ui/Icon';

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
  const styles = useStyles();
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

/**
 * Amber "Update available" pill overlaid on stale documents (Figma 1:1440).
 *
 * Silent to screen readers by default, because a library card already says it in its own label.
 * `announce` is for a page that has no such label to carry it — the editor's meta strip.
 */
export function UpdateAvailablePill({
  announce = false,
  style,
}: {
  announce?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radii, spacing } = useTheme();
  const styles = useStyles();
  return (
    <View
      accessibilityElementsHidden={!announce}
      importantForAccessibility={announce ? 'auto' : 'no-hide-descendants'}
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
      <Icon name="RefreshCw01" size="xs" color={colors.warningStrong} />
      <Text variant="microBadge" color="warningStrong" numberOfLines={1}>
        Update available
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: s(10),
    paddingVertical: s(5),
  },
}));
