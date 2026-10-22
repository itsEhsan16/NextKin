import { View } from 'react-native';

import AiSparkle from '../../../../assets/icons/jobs/ai-sparkle.svg';
import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type MatchReasonProps = {
  /** One line on why the job matches. The panel is not rendered without it. */
  reason: string;
};

/**
 * The lavender "why this matched" panel on a job card (Figma 498:23).
 *
 * Every number is the drawn value over 0.75, because the Jobs boards are the 390-wide twins of
 * the 520 page `s()` projects from. Drawn: a 46-tall panel, the sparkle at 7.25 in a 22 box, a
 * 0.75 × 16 rule at 36, and two lines of copy from 44.75 to 314.5.
 */
const PANEL = {
  radius: 13.3333,
  paddingLeft: 9.6667,
  paddingRight: 13.3333,
  paddingVertical: 10.6667,
  icon: 29.3333,
  iconHeight: 28.7328,
  ruleGap: 9,
  ruleWidth: 1,
  ruleHeight: 21.3333,
  textGap: 10.6667,
};

export function MatchReason({ reason }: MatchReasonProps) {
  const { colors, s } = useTheme();
  const styles = useStyles();

  return (
    <View
      // No a11y props of its own: the card around it is a single accessibility element and folds
      // this line into its label, so the subtree is already collapsed by the time it gets here.
      style={[
        styles.panel,
        { backgroundColor: colors.brandSurface, borderRadius: s(PANEL.radius) },
      ]}
    >
      <AiSparkle width={s(PANEL.icon)} height={s(PANEL.iconHeight)} />
      <View
        style={{
          width: s(PANEL.ruleWidth),
          height: s(PANEL.ruleHeight),
          backgroundColor: colors.matchReasonRule,
        }}
      />
      <Text variant="caption" color="textBody" numberOfLines={2} style={styles.copy}>
        {reason}
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(PANEL.ruleGap),
    paddingLeft: s(PANEL.paddingLeft),
    paddingRight: s(PANEL.paddingRight),
    paddingVertical: s(PANEL.paddingVertical),
  },
  copy: { flex: 1, marginLeft: s(PANEL.textGap - PANEL.ruleGap) },
}));
