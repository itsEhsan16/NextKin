import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';

import { a11yButton } from '@/lib';
import { useLayoutScale, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type HeroBlockProps = {
  onFindJobs: () => void;
};

const TILE = 130;
const TILE_ICON = 26;

/** Figma 1:29 — "Build better. / Land faster." next to the black "Find Jobs" tile. */
export function HeroBlock({ onFindJobs }: HeroBlockProps) {
  const { colors, radii, spacing, typography } = useTheme();
  const { s } = useLayoutScale();
  const tile = s(TILE, 96);

  return (
    <View style={[styles.row, { gap: spacing[4] }]}>
      <Text
        accessibilityRole="header"
        variant="hero"
        style={{
          flex: 1,
          fontSize: s(typography.hero.fontSize ?? 46),
          lineHeight: s(typography.hero.lineHeight ?? 53),
        }}
      >
        {'Build better.\nLand faster.'}
      </Text>
      <Pressable
        {...a11yButton('Find Jobs', 'Opens the Jobs tab')}
        feedback="scale"
        haptic="light"
        onPress={onFindJobs}
        style={[
          styles.tile,
          {
            width: tile,
            height: tile,
            borderRadius: radii.cardLg,
            backgroundColor: colors.surfaceBlack,
            gap: 11,
          },
        ]}
      >
        <FontAwesome5 name="search" size={s(TILE_ICON, 20)} color={colors.textOnBrand} solid />
        <Text variant="body" color="textOnBrand">
          Find Jobs
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  tile: { alignItems: 'center', justifyContent: 'center' },
});
