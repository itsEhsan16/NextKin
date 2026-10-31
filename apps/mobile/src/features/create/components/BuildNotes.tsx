import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';

// The OR rule (652:58) and the lightbulb tip cards (653:28 / 653:109 / 653:201), at 390.
const OR_GAP = 12 / 0.75;
const TIP_PAD_L = 13 / 0.75;
const TIP_PAD_R = 14 / 0.75;
const TIP_PAD_Y = 12 / 0.75;
const TIP_GAP = 12 / 0.75;
const TIP_RADIUS = 14 / 0.75;
const TIP_TILE = 34 / 0.75;
const TIP_TEXT_GAP = 2 / 0.75;

/** "—— OR ——" between two ways in (652:58). Decoration: each way in names itself. */
export function OrDivider() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View
      style={styles.or}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.orLine, { backgroundColor: colors.borderDefault }]} />
      <Text variant="microBadge" color="textTertiary">
        OR
      </Text>
      <View style={[styles.orLine, { backgroundColor: colors.borderDefault }]} />
    </View>
  );
}

/**
 * A lightbulb tip (653:28): "Supported links", "Why this happens", or one line on what comes
 * next. One reading stop: the title, then the line.
 */
export function BuildTipCard({ title, text }: { title?: string; text: string }) {
  const { colors, radii } = useTheme();
  const styles = useStyles();
  return (
    <View accessible style={[styles.tip, { backgroundColor: colors.brandSurface }]}>
      <View
        style={[styles.tipTile, { borderRadius: radii.full, backgroundColor: colors.tileBrand }]}
      >
        <Icon name="Lightbulb02" size="sm" color={colors.glyphNote} />
      </View>
      <View style={styles.tipText}>
        {title ? <Text variant="captionSemiBold">{title}</Text> : null}
        <Text variant={title ? 'micro' : 'caption'} color="textBody">
          {text}
        </Text>
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  or: { flexDirection: 'row', alignItems: 'center', gap: s(OR_GAP) },
  orLine: { flex: 1, height: s(1) },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(TIP_GAP),
    paddingLeft: s(TIP_PAD_L),
    paddingRight: s(TIP_PAD_R),
    paddingVertical: s(TIP_PAD_Y),
    borderRadius: s(TIP_RADIUS),
  },
  tipTile: {
    width: s(TIP_TILE),
    height: s(TIP_TILE),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: { flex: 1, gap: s(TIP_TEXT_GAP) },
}));
