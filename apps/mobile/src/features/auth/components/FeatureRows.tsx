import { View } from 'react-native';
import type { SvgProps } from 'react-native-svg';

import ApplyIcon from '../../../../assets/icons/onboarding/apply.svg';
import InsightsIcon from '../../../../assets/icons/onboarding/insights.svg';
import TrackIcon from '../../../../assets/icons/onboarding/track.svg';
import { board } from '../board';
import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

/** Figma 295:2940 / 295:2949 / 295:2960 — three cards, 80.79 tall, 10.63 apart. */
const ROW = { height: 80.79, radius: 19.134, gap: 10.63, copyLeft: 93.5, copyGap: 5.3 };

/**
 * Each glyph with the box and offset the board draws it at — they differ per row, so the icon is
 * placed rather than laid out. Rendered through a function so callers invoke them inline instead
 * of creating components during render, the pattern `ShortcutGrid` established.
 */
const FEATURES = [
  {
    title: 'Apply to jobs',
    caption: 'With a single click',
    render: (props: SvgProps) => <ApplyIcon {...props} />,
    w: 43.3622,
    h: 42.5189,
    x: 18.07,
    y: 19.87,
  },
  {
    title: 'Track your progress',
    caption: 'Stay on top of your applications',
    render: (props: SvgProps) => <TrackIcon {...props} />,
    w: 43,
    h: 43,
    x: 22.32,
    y: 18.8,
  },
  {
    title: 'Get personalized insights',
    caption: 'Find better opportunities',
    render: (props: SvgProps) => <InsightsIcon {...props} />,
    w: 43,
    h: 51,
    x: 26.57,
    y: 14.55,
  },
] as const;

/**
 * Onboarding slide 3's three feature rows (Figma 295:2939).
 *
 * The glyphs are the board's own vectors, lifted out of the artboard. They are two-tone — dark
 * ink over a pale mint or lavender shape — which is why the FontAwesome stand-ins they replaced
 * read as flat single-colour icons however they were tinted.
 *
 * `alignSelf: stretch` is load-bearing: the slide centres its illustration slot, so without it
 * the cards shrink to their content, the copy column's `flex: 1` resolves to zero and the text
 * disappears entirely — which is exactly what the first device pass showed.
 */
export function FeatureRows() {
  const { colors, artboardShadows, s } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.rows, { gap: s(board(ROW.gap)) }]}>
      {FEATURES.map(({ title, caption, render, w, h, x, y }) => (
        <View
          key={title}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${title}. ${caption}`}
          style={[
            styles.row,
            artboardShadows.card,
            {
              height: s(board(ROW.height)),
              borderRadius: s(board(ROW.radius)),
              backgroundColor: colors.surfaceCard,
            },
          ]}
        >
          <View style={{ position: 'absolute', left: s(board(x)), top: s(board(y)) }}>
            {render({ width: s(board(w)), height: s(board(h)) })}
          </View>
          <View style={[styles.copy, { marginLeft: s(board(ROW.copyLeft)), gap: s(board(ROW.copyGap)) }]}>
            <Text variant="featureTitle" color="onboardingInk">
              {title}
            </Text>
            <Text variant="featureCaption" color="onboardingBody">
              {caption}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  rows: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1 },
}));
