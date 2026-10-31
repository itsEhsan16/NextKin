import { StyleSheet, View } from 'react-native';

import { a11yButton } from '@/lib';
import { useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';

export type HeroBlockProps = {
  onFindJobs: () => void;
};

const TILE = 130;

/** Figma 1:29 — "Build better. / Land faster." next to the black "Find Jobs" tile. */
export function HeroBlock({ onFindJobs }: HeroBlockProps) {
  const { colors, radii, spacing, s } = useTheme();
  const tile = s(TILE);

  return (
    <View style={[styles.row, { gap: spacing[4] }]}>
      <Text accessibilityRole="header" variant="hero" style={styles.heading}>
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
            gap: s(11),
          },
        ]}
      >
        <Icon name="SearchLg" size="lg" color={colors.textOnBrand} />
        <Text variant="body" color="textOnBrand">
          Find Jobs
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  heading: { flex: 1 },
  tile: { alignItems: 'center', justifyContent: 'center' },
});
