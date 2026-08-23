import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton, pluralize } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type FilterButtonProps = {
  /** Number of active filters; renders the count badge when > 0. */
  count: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const ICON = 17;

/** Figma 1:271 — 52pt outlined square with the sliders glyph and an ink count badge. */
export function FilterButton({ count, onPress, style }: FilterButtonProps) {
  const { colors, radii, sizes } = useTheme();

  return (
    <Pressable
      {...a11yButton(
        count > 0 ? `Filters, ${pluralize(count, 'filter')} applied` : 'Filters',
        'Opens the filter sheet',
      )}
      feedback="scale"
      haptic="light"
      onPress={onPress}
      style={[
        {
          width: sizes.filterButton,
          height: sizes.filterButton,
          borderRadius: radii.xl,
          borderWidth: 1,
          borderColor: colors.borderDefault,
          backgroundColor: colors.surfaceCard,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <FontAwesome5 name="sliders-h" size={ICON} color={colors.textPrimary} solid />

      {count > 0 ? (
        <View
          // Decorative: the count is already in the button's accessibility label.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            position: 'absolute',
            top: -sizes.filterBadge / 4,
            right: -sizes.filterBadge / 4,
            minWidth: sizes.filterBadge,
            height: sizes.filterBadge,
            paddingHorizontal: 4,
            borderRadius: radii.full,
            borderWidth: 2,
            borderColor: colors.surfaceCard,
            backgroundColor: colors.surfaceSelected,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="badgeCount" color="textOnBrand" align="center">
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
