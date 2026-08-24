import { StyleSheet, View } from 'react-native';

import Mark1 from '../../../../assets/brand/mark-1.svg';
import Mark2 from '../../../../assets/brand/mark-2.svg';
import Mark3 from '../../../../assets/brand/mark-3.svg';
import { useLayoutScale } from '@/theme';
import { Text } from '@/ui/Text';

/** Figma 1:23 — the mark is three layered vectors inside a 51×53 box; wordmark at x=65. */
const MARK_BOX = { width: 51, height: 53 } as const;
const MARK_LAYERS = [
  { Icon: Mark1, x: 0, y: 0, width: 37, height: 35 },
  { Icon: Mark2, x: 22, y: 21, width: 29, height: 32 },
  { Icon: Mark3, x: 23, y: 21, width: 28, height: 19 },
] as const;
const WORDMARK_X = 65;
const TAGLINE = "WITH AI THAT WON'T LIE ON YOUR RESUME.";

/** Logo lock-up + tagline (Figma 1:20). Geometry scales with the artboard ratio. */
export function BrandBlock() {
  const { s } = useLayoutScale();

  return (
    <View accessible accessibilityRole="header" accessibilityLabel={`NextKin. ${TAGLINE}`}>
      <View style={[styles.row, { height: s(MARK_BOX.height) }]}>
        <View style={{ width: s(MARK_BOX.width), height: s(MARK_BOX.height) }}>
          {MARK_LAYERS.map(({ Icon, x, y, width, height }, index) => (
            <View
              key={index}
              style={{ position: 'absolute', left: s(x), top: s(y), width: s(width), height: s(height) }}
            >
              <Icon width={s(width)} height={s(height)} />
            </View>
          ))}
        </View>
        <Text
          variant="wordmark"
          style={{ marginLeft: s(WORDMARK_X - MARK_BOX.width) }}
        >
          NextKin
        </Text>
      </View>
      <Text variant="caption" color="textSecondary" style={{ letterSpacing: 0.325, marginTop: 6 }}>
        {TAGLINE}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
