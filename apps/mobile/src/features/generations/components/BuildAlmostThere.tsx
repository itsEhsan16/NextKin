import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

// "Almost there" at 390 (653:173), in artboard units.
const PAD_LEFT = 14 / 0.75;
const PAD_RIGHT = 15 / 0.75;
const PAD_Y = 14 / 0.75;
const GAP = 14 / 0.75;
const RADIUS = 16 / 0.75;
const ART = 72 / 0.75; // 653:174
const ART_RADIUS = 18 / 0.75;
const ROBOT = 26 / 0.75;
const TEXT_GAP = 3 / 0.75;

const TEXT =
  'This usually takes about a minute. You can leave — we’ll let you know when it’s ready.';

/**
 * BUILD 05's "Almost there!" (653:173) under the checklist: the wait, said once, beside a small
 * robot. IL-BD5 is still a placeholder on the board, so the robot glyph on a lavender tile stands
 * in until it is drawn (illustrations-needed.md). One reading stop.
 */
export function BuildAlmostThere() {
  const { colors, s } = useTheme();
  const styles = useStyles();
  return (
    <View accessible style={[styles.card, { backgroundColor: colors.brandSurface }]}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.art, { backgroundColor: colors.tileBrand }]}
      >
        <FontAwesome5 name="robot" size={s(ROBOT)} color={colors.brand} solid />
      </View>
      <View style={styles.text}>
        <Text variant="label">Almost there!</Text>
        <Text variant="caption" color="textBody">
          {TEXT}
        </Text>
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(GAP),
    paddingLeft: s(PAD_LEFT),
    paddingRight: s(PAD_RIGHT),
    paddingVertical: s(PAD_Y),
    borderRadius: s(RADIUS),
  },
  art: {
    width: s(ART),
    height: s(ART),
    borderRadius: s(ART_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: s(TEXT_GAP) },
}));
