import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

type NewDocProps = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const GRID_PLUS = 56;
const ROW_PLUS = 44;

/** Dashed "+ New" tile leading the grid (Figma 1:1394). Opens the create sheet. */
export function NewDocTile({ onPress, style }: NewDocProps) {
  const { colors, radii, spacing } = useTheme();
  const styles = useStyles();

  return (
    <Pressable
      {...a11yButton('New', 'Create a resume or cover letter')}
      feedback="scale"
      haptic="light"
      onPress={onPress}
      style={[
        styles.tile,
        {
          gap: spacing[2],
          borderRadius: radii.card,
          borderColor: colors.borderDashed,
          backgroundColor: colors.surfaceFaint,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.plus,
          {
            width: GRID_PLUS,
            height: GRID_PLUS,
            borderRadius: radii.full,
            backgroundColor: colors.surfaceInverse,
            marginBottom: spacing[2],
          },
        ]}
      >
        <FontAwesome5 name="plus" size={20} color={colors.textOnDark} solid />
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

/** The list layout's dashed "+ New resume or cover letter" row (Figma 1:1616). */
export function NewDocRow({ onPress, style }: NewDocProps) {
  const { colors, radii, spacing } = useTheme();
  const styles = useStyles();

  return (
    <Pressable
      {...a11yButton('New resume or cover letter')}
      feedback="scale"
      haptic="light"
      onPress={onPress}
      style={[
        styles.row,
        {
          gap: spacing[4],
          padding: spacing[4] - 1,
          borderRadius: radii.xxl,
          borderColor: colors.borderDashed,
          backgroundColor: colors.surfaceFaint,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.plus,
          {
            width: ROW_PLUS,
            height: ROW_PLUS,
            borderRadius: radii.full,
            backgroundColor: colors.surfaceInverse,
          },
        ]}
      >
        <FontAwesome5 name="plus" size={17} color={colors.textOnDark} solid />
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
