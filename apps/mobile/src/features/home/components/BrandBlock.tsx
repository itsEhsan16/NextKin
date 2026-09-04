import { StyleSheet, View } from 'react-native';

import Mark1 from '../../../../assets/brand/mark-1.svg';
import Mark2 from '../../../../assets/brand/mark-2.svg';
import Mark3 from '../../../../assets/brand/mark-3.svg';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

/** Figma 1:23 — the mark is three layered vectors inside a 51×53 box; wordmark at x=65. */
const MARK_BOX = { width: 51, height: 53 } as const;
const MARK_LAYERS = [
  { Icon: Mark1, x: 0, y: 0, width: 37, height: 35 },
  { Icon: Mark2, x: 22, y: 21, width: 29, height: 32 },
  { Icon: Mark3, x: 23, y: 21, width: 28, height: 19 },
] as const;
const WORDMARK_X = 65;

/**
 * The logo lock-up (Figma 1:20 / 115:20).
 *
 * The 520 board carries a tagline under the wordmark; the 390 board does not — the container and
 * its text node are gone, not hidden, though the frame keeps the height they used to occupy.
 * Mobile 2 is what ships, so the tagline goes and the block hugs the wordmark rather than leaving
 * a gap where a deleted line used to be.
 */
export function BrandBlock() {
  const { s } = useTheme();

  return (
    <View accessible accessibilityRole="header" accessibilityLabel="NextKin">
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
