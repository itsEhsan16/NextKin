import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { BookmarkGlyph } from './BookmarkGlyph';

export type JobDetailActionsProps = {
  saved: boolean;
  onToggleSave: () => void;
  onApply: () => void;
};

const ICON = 14;
/** Save's width — the same secondary width `StickyActionBar` gives its ghost button. */
const SAVE_WIDTH = 140;

/**
 * Pinned Save / Apply bar (Figma 1:923). Save is hand-built rather than a `Button` because the
 * bookmark has to switch between the Regular outline and the Solid fill, which `Button`'s single
 * icon slot cannot express.
 *
 * Carries the bottom safe-area inset itself — canvas note 1:1043's "sticky bar carries 44px".
 */
export function JobDetailActions({ saved, onToggleSave, onApply }: JobDetailActionsProps) {
  const { colors, radii, shadows, sizes, spacing, zIndex, s } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        // The shadow and stacking every other pinned action bar has (`StickyActionBar`).
        shadows.stickyBarUp,
        {
          zIndex: zIndex.stickyBar,
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
        <BookmarkGlyph saved={saved} size={s(ICON)} color={colors.textPrimary} />
        <Text variant="bodySemiBold">{saved ? 'Saved' : 'Save'}</Text>
      </Pressable>

      <Button size="lg" label="Apply now" haptic="medium" onPress={onApply} style={styles.apply} />
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  bar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  save: {
    flexBasis: s(SAVE_WIDTH),
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: s(1),
  },
  apply: { flex: 1, justifyContent: 'center' },
}));
