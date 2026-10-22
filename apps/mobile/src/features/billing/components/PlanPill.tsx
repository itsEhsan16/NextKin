import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

// BILLING 01's pills at 390 ("Free plan" 577:9196, "Your plan" 577:9237), in artboard units.
const PAD_LEFT = 9 / 0.75;
const PAD_RIGHT = 10 / 0.75;
const PAD_Y = 4 / 0.75;

/**
 * The small rounded label on the plan screen: grey for a statement of where the reader stands
 * ("Free plan", "Your plan"), brand tint for a plan's own ribbon ("Save 55%").
 */
export function PlanPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'brand';
}) {
  const { colors, radii } = useTheme();
  const styles = useStyles();
  const brand = tone === 'brand';

  return (
    <View
      style={[
        styles.pill,
        {
          borderRadius: radii.full,
          backgroundColor: brand ? colors.tileBrandStrong : colors.surfaceSubtle,
        },
      ]}
    >
      <Text variant="microBadge" color={brand ? 'brand' : 'textBody'} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: s(PAD_LEFT),
    paddingRight: s(PAD_RIGHT),
    paddingVertical: s(PAD_Y),
  },
}));
