import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { BrandMark, BRAND_MARK_BOX } from '@/ui/BrandMark';
import { Text } from '@/ui/Text';

/** Figma 1:23 — the mark sits in a 51×53 box and the wordmark starts at x=65. */
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
      <View style={[styles.row, { height: s(BRAND_MARK_BOX.height) }]}>
        <BrandMark />
        <Text variant="wordmark" style={{ marginLeft: s(WORDMARK_X - BRAND_MARK_BOX.width) }}>
          NextKin
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
