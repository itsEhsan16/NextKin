import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';

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
  const { colors, shadows, spacing, zIndex, u } = useTheme();
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
      {/* Twins (§198): the same pill, height and bold label, an equal half each. */}
      <Button
        size="xl"
        variant="soft"
        label="Tailor resume"
        leading={<Icon name="Stars02" size={u(18)} color={colors.brand} />}
        onPress={onTailor}
        style={styles.half}
      />
      <Button size="xl" label="Apply now" onPress={onApply} style={styles.half} />
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  bar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  // An equal share each whatever their labels: no basis from the content, no padding override.
  half: { flexGrow: 1, flexShrink: 1, flexBasis: 0, paddingHorizontal: 0 },
}));
