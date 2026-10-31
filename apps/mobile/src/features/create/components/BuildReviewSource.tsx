import { View } from 'react-native';

import { a11yButton, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';

export type BuildReviewSourceProps = {
  /** The link, "Pasted description" or the file's name. */
  label: string;
  /** Back to BUILD 03 to add a different job. */
  onChange: () => void;
};

// The source row at 390 (653:71), in artboard units.
const PAD_X = 14 / 0.75;
const PAD_Y = 11 / 0.75;
const GAP = 10 / 0.75;
const RADIUS = 14 / 0.75;
const CHANGE_H = 16 / 0.75;

/** BUILD 04's grey row (653:71): where the job came from, and a brand Change back to BUILD 03. */
export function BuildReviewSource({ label, onChange }: BuildReviewSourceProps) {
  const { colors, sizes, s } = useTheme();
  const styles = useStyles();

  return (
    <View
      style={[
        styles.row,
        {
          borderWidth: sizes.border,
          borderColor: colors.borderHairline,
          backgroundColor: colors.surfaceFaint,
        },
      ]}
    >
      <Icon name="Link01" size="sm" color={colors.textBody} />
      <Text
        variant="bodyMedium"
        color="textBody"
        numberOfLines={1}
        accessibilityLabel={`Job from ${label}`}
        style={styles.label}
      >
        {label}
      </Text>
      <Pressable
        {...a11yButton('Change', 'Add a different job')}
        feedback="scale"
        haptic="light"
        hitSlop={hitSlopFor(s(CHANGE_H))}
        onPress={onChange}
      >
        <Text variant="microBadge" color="brand">
          Change
        </Text>
      </Pressable>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(PAD_X),
    paddingVertical: s(PAD_Y),
    gap: s(GAP),
    borderRadius: s(RADIUS),
  },
  label: { flex: 1 },
}));
