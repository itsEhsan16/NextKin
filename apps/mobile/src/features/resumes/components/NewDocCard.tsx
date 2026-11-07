import { View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';

type NewDocProps = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const GRID_PLUS = 56;
const ROW_PLUS = 44;

/** Dashed "+ New" tile leading the grid (Figma 95:1555). Opens the create sheet. */
export function NewDocTile({ onPress, style }: NewDocProps) {
  const { colors, radii, spacing, s } = useTheme();
  const styles = useStyles();

  return (
    <Pressable
      {...a11yButton('New', 'Create a resume or cover letter')}
      feedback="scale"
      onPress={onPress}
      style={[
        styles.tile,
        {
          gap: spacing[2],
          borderRadius: radii.card,
          borderColor: colors.borderDashed,
          backgroundColor: colors.surfaceNewDoc,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.plus,
          {
            width: s(GRID_PLUS),
            height: s(GRID_PLUS),
            borderRadius: radii.full,
            backgroundColor: colors.surfaceInverse,
            marginBottom: spacing[2],
          },
        ]}
      >
        <Icon name="Plus" size={s(36.36)} color={colors.textOnDark} />
      </View>
      <Text variant="label" align="center">
        New
      </Text>
      <Text variant="captionSm" color="textSecondary" align="center">
        Resume or cover letter
      </Text>
    </Pressable>
  );
}

/** The list layout's dashed "+ New resume or cover letter" row (Figma 95:1797). */
export function NewDocRow({ onPress, style }: NewDocProps) {
  const { colors, radii, spacing, s } = useTheme();
  const styles = useStyles();

  return (
    <Pressable
      {...a11yButton('New resume or cover letter')}
      feedback="scale"
      onPress={onPress}
      style={[
        styles.row,
        {
          gap: spacing[4],
          padding: spacing[4] - 1,
          borderRadius: radii.xxl,
          borderColor: colors.borderDashed,
          backgroundColor: colors.surfaceNewDoc,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.plus,
          {
            width: s(ROW_PLUS),
            height: s(ROW_PLUS),
            borderRadius: radii.full,
            backgroundColor: colors.surfaceInverse,
          },
        ]}
      >
        <Icon name="Plus" size="lg" color={colors.textOnDark} />
      </View>
      <Text variant="label">New resume or cover letter</Text>
    </Pressable>
  );
}

const useStyles = scaledSheet((s) => ({
  tile: {
    borderWidth: s(1),
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    borderWidth: s(1),
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
  },
  plus: { alignItems: 'center', justifyContent: 'center' },
}));
