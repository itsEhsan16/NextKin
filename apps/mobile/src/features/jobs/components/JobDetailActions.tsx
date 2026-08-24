import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type JobDetailActionsProps = {
  saved: boolean;
  onToggleSave: () => void;
  onApply: () => void;
};

const ICON = 14;

/**
 * Pinned Save / Apply bar (Figma 1:923). Save is hand-built rather than a `Button` because the
 * bookmark has to switch between the Regular outline and the Solid fill, which `Button`'s single
 * icon slot cannot express.
 *
 * Carries the bottom safe-area inset itself — canvas note 1:1043's "sticky bar carries 44px".
 */
export function JobDetailActions({ saved, onToggleSave, onApply }: JobDetailActionsProps) {
  const { colors, radii, sizes, spacing, s } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing[4],
          paddingBottom: spacing[4] + insets.bottom,
          gap: spacing[4],
          borderTopColor: colors.borderHairline,
          backgroundColor: colors.surfacePage,
        },
      ]}
    >
      <Pressable
        {...a11yButton(saved ? 'Saved' : 'Save')}
        accessibilityState={{ selected: saved }}
        feedback="scale"
        haptic="light"
        onPress={onToggleSave}
        style={[
          styles.save,
          {
            height: sizes.buttonLg,
            borderRadius: radii.xl,
            borderColor: colors.borderDefault,
            backgroundColor: colors.surfaceCard,
            gap: spacing[2],
          },
        ]}
      >
        <FontAwesome5 name="bookmark" size={s(ICON)} color={colors.textPrimary} solid={saved} />
        <Text variant="label">{saved ? 'Saved' : 'Save'}</Text>
      </Pressable>

      <Button
        size="lg"
        label="Apply now"
        haptic="medium"
        onPress={onApply}
        style={styles.apply}
      />
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  bar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  save: {
    flexBasis: 140,
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: s(1),
  },
  apply: { flex: 1, justifyContent: 'center' },
}));
