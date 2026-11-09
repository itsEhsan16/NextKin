import { View } from 'react-native';
import type { SvgProps } from 'react-native-svg';

import ApplyIcon from '../../../../assets/icons/onboarding/apply.svg';
import InsightsIcon from '../../../../assets/icons/onboarding/insights.svg';
import TrackIcon from '../../../../assets/icons/onboarding/track.svg';
import { board } from '../board';
import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

/**
 * Figma 307:4298 / 307:4307 / 307:4318 — three cards, 71.21 tall, 9.37 apart, in a 312 column.
 *
 * The redraw took the whole block to 88% of its first size and stopped it filling the gutter:
 * the column is now a fixed 312 sitting 12 in from the slide's own 43 left padding, which puts
 * it on the frame's centre line rather than the copy column's.
 */
const ROW = { width: 312, left: 12, height: 71.20721, radius: 16.865, gap: 9.36929 };
const COPY = { left: 82.4512, gap: 4.68468 };

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
    w: 38.22082,
    h: 37.47747,
    x: 15.92833,
    y: 17.51131,
  },
  {
    title: 'Track your progress',
    caption: 'Stay on top of your applications',
    render: (props: SvgProps) => <TrackIcon {...props} />,
    w: 37.47791,
    h: 37.49927,
    x: 19.67565,
    y: 16.57463,
  },
  {
    title: 'Get personalized insights',
    caption: 'Find better opportunities',
    render: (props: SvgProps) => <InsightsIcon {...props} />,
    w: 37.47747,
    h: 44.30486,
    x: 23.4234,
    y: 12.82623,
  },
] as const;

/**
 * Onboarding slide 3's three feature rows (Figma 307:4297).
 *
 * The glyphs are the board's own vectors, lifted out of the artboard. They are two-tone — dark
 * ink over a pale mint or lavender shape — which is why the FontAwesome stand-ins they replaced
 * read as flat single-colour icons however they were tinted.
 *
 * The column carries its width and its left offset itself rather than stretching, because the
 * slide's art slot centres what it is given and the board does not: the cards are centred on the
 * frame, the illustration under them is not. Stating both here keeps `copy: { flex: 1 }` fed —
 * a column with no width at all is what made the text vanish on the first device pass.
 */
export function FeatureRows() {
  const { colors, artboardShadows, s } = useTheme();
  const styles = useStyles();

  return (
    <View
      style={[
        styles.rows,
        { width: s(board(ROW.width)), marginLeft: s(board(ROW.left)), gap: s(board(ROW.gap)) },
      ]}
    >
      {FEATURES.map(({ title, caption, render, w, h, x, y }) => (
        <View
          key={title}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${title}. ${caption}`}
          style={[
            styles.row,
            artboardShadows.onboardingFeatureCard,
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
          <View style={[styles.copy, { marginLeft: s(board(COPY.left)), gap: s(board(COPY.gap)) }]}>
            {/* Drawn copy in a fixed-height card: held at the board's size, one line each (§206). */}
            <Text
              variant="onboardingCardTitle"
              color="onboardingInk"
              numberOfLines={1}
              adjustsFontSizeToFit
              maxFontSizeMultiplier={1}
            >
              {title}
            </Text>
            <Text
              variant="onboardingCardCaption"
              color="onboardingBody"
              numberOfLines={1}
              adjustsFontSizeToFit
              maxFontSizeMultiplier={1}
            >
              {caption}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  rows: { alignSelf: 'flex-start', flexShrink: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1 },
}));
