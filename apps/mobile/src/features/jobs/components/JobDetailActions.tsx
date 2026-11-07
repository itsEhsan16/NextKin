import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type JobDetailActionsProps = {
  /** Opens the resume picker that tailors one to this job. */
  onTailor: () => void;
  onApply: () => void;
};

/**
 * The job's pinned bar (owner, 2026-11-08, §183): "Tailor resume" with the AI sparkle beside
 * "Apply now". Saving lives on the bookmark at the top of the page, so the bar carries the two
 * things to do with the job: make a resume for it, then apply.
 */
export function JobDetailActions({ onTailor, onApply }: JobDetailActionsProps) {
  const { colors, radii, shadows, sizes, spacing, zIndex, u } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        shadows.stickyBarUp,
        {
          zIndex: zIndex.stickyBar,
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing[4],
          paddingBottom: spacing[4] + insets.bottom,
          gap: spacing[3],
          borderTopColor: colors.borderHairline,
          backgroundColor: colors.surfacePage,
        },
      ]}
    >
      <Pressable
        {...a11yButton('Tailor resume', 'Pick a resume to tailor to this job')}
        feedback="scale"
        haptic="light"
        onPress={onTailor}
        style={[
          styles.tailor,
          {
            height: sizes.buttonLg,
            borderRadius: radii.full,
            backgroundColor: colors.brandSurface,
            gap: spacing[2],
          },
        ]}
      >
        <Icon name="Stars02" size={u(18)} color={colors.brand} />
        <Text variant="bodySemiBold" color="brand">
          Tailor resume
        </Text>
      </Pressable>

      <Button
        size="lg"
        label="Apply now"
        haptic="medium"
        onPress={onApply}
        style={[styles.apply, { borderRadius: radii.full }]}
      />
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  bar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  tailor: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  apply: { flex: 1, justifyContent: 'center' },
}));
