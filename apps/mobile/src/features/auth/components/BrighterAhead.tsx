import { View } from 'react-native';

import Artwork from '../../../../assets/onboarding/brighter-ahead.svg';
import { board } from '../board';
import { scaledSheet, useTheme } from '@/theme';

/**
 * Figma 309:96 — 306 x 201.68, drawn 3 in from the slide's own 43 of left padding and 9.99 under
 * the last feature card. That 9.99 is a margin rather than a gap on the parent on purpose: the
 * parent distributes what is left over, so only a margin survives the shrink below.
 */
const ART = { width: 306, height: 201.682, left: 3, top: 9.99139, ratio: 306 / 201.682 };

/**
 * Slide 3's illustration (Figma 309:96): a figure with a raised fist over a lavender wash, under
 * hand-lettered "A Brighter You Ahead." — vector paths on the board, not a text node, so the
 * lettering comes out as part of the drawing.
 *
 * **This is the one thing on the slide allowed to shrink, and it has to be.** The redraw fills
 * all 895 of the frame with 0.3 to spare: copy, cards and art run from the head room down to the
 * bottom bar with nothing between them. A phone shorter than the board's own 2.12:1 — an SE at
 * 1.78:1 is 127pt short — has no room for all of it, and a device whose status bar is deeper
 * than the 41 the board budgets takes another 9 to 23 off the top. Nothing in RN shrinks by
 * default, so without this the art would simply run under the bar.
 *
 * `aspectRatio` against a shrinking height keeps it in proportion rather than squashing it, and
 * the cards above hold their size: they carry the words, and words do not scale.
 */
export function BrighterAhead() {
  const { s } = useTheme();
  const styles = useStyles();

  return (
    // One decorative drawing to a screen reader. The heading above already says what the slide
    // is about, and reading the lettering out after it would only repeat the sentiment.
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="A brighter you ahead"
      style={[
        styles.art,
        {
          height: s(board(ART.height)),
          aspectRatio: ART.ratio,
          marginTop: s(board(ART.top)),
          marginLeft: s(board(ART.left)),
        },
      ]}
    >
      <Artwork width="100%" height="100%" />
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  /** Shrinks where the cards above it do not; left-anchored because the board does not centre it. */
  art: { alignSelf: 'flex-start', flexShrink: 1 },
}));
