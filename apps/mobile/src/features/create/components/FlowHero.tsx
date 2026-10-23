import { Image, type ImageProps } from 'expo-image';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';
import { useLoop } from '@/ui/motion';

import { LiveArt, type LiveAnchors, type LiveMotif } from './LiveArt';

/**
 * The flow boards' illustrations, each the board's own render of its layer (3× PNG): where it
 * sits, at 390, and how far its title stands below it.
 */
export type FlowArt = {
  source: ImageProps['source'];
  w: number;
  h: number;
  /** Off-centre on the board: the setup drawing's sparks push its box right (656:60 at x 85). */
  shiftX: number;
  toTitle: number;
  /** Where motion can sit on the drawing while a run works (`LiveArt`), for the run boards. */
  live?: LiveAnchors;
};

/** The writing robot, shared by TAILOR 04 (661:40) and BUILD 05 (661:34): one render, one page. */
const ROBOT_PAGE: LiveAnchors = {
  px: { w: 765, h: 585 },
  sparkles: [
    { x: 634, y: 118, size: 80 },
    { x: 696.5, y: 177, size: 44 },
    { x: 40, y: 378, size: 58 },
  ],
  lines: {
    angle: 3.8,
    thickness: 21,
    rows: [
      { x: 447, y: 284, length: 161 },
      { x: 439, y: 343.5, length: 228 },
      { x: 432, y: 394, length: 158 },
      { x: 426, y: 440.5, length: 226 },
      { x: 420, y: 487, length: 169 },
    ],
  },
};

export const FLOW_ART = {
  coverSetup: {
    source: require('../../../../assets/illustrations/cover/cover-setup.png'),
    w: 255,
    h: 204,
    shiftX: 17.5,
    toTitle: 19, // 656:60 → 644:29
  },
  coverWriting: {
    source: require('../../../../assets/illustrations/cover/cover-writing.png'),
    w: 269,
    h: 207,
    shiftX: 0,
    toTitle: 16, // 656:51 → 644:111
    live: {
      px: { w: 807, h: 621 },
      sparkles: [
        { x: 701.5, y: 117.5, size: 70 },
        { x: 748.5, y: 170, size: 40 },
        { x: 93.5, y: 379, size: 68 },
      ],
      lines: {
        angle: 3.5,
        thickness: 19,
        rows: [
          { x: 501, y: 305.5, length: 221 },
          { x: 491, y: 351.5, length: 219 },
          { x: 481, y: 397.5, length: 216 },
          { x: 471, y: 443.5, length: 211 },
          { x: 461, y: 490, length: 156 },
        ],
      },
    },
  },
  zeroAbout: {
    source: require('../../../../assets/illustrations/zero/zero-about.png'),
    w: 255,
    h: 174.33,
    shiftX: 0,
    toTitle: 14, // 661:25 → 613:246
  },
  zeroWriting: {
    // The render runs past the layer's 255 × 176 box (661:14), so it is drawn at its own size
    // around the same centre.
    source: require('../../../../assets/illustrations/zero/zero-writing.png'),
    w: 263,
    h: 184,
    shiftX: 0,
    toTitle: 10, // 661:14 → 613:322
    live: {
      px: { w: 789, h: 552 },
      sparkles: [
        { x: 624, y: 98, size: 52 },
        { x: 660.5, y: 138.5, size: 35 },
        { x: 81.5, y: 337, size: 50 },
      ],
      lines: {
        angle: 5,
        thickness: 19,
        rows: [
          { x: 459, y: 214, length: 127 },
          { x: 453, y: 260.3, length: 188 },
          { x: 448, y: 302.8, length: 187 },
          { x: 442, y: 344.3, length: 187 },
          { x: 436, y: 387.3, length: 142 },
          { x: 430, y: 431.3, length: 119 },
        ],
      },
    },
  },
  atsUpload: {
    source: require('../../../../assets/illustrations/ats/ats-upload.png'),
    w: 200,
    h: 135,
    shiftX: 0,
    toTitle: 29, // 656:14 → 645:14
  },
  atsPaste: {
    source: require('../../../../assets/illustrations/ats/ats-paste.png'),
    w: 222,
    h: 159,
    shiftX: 0,
    toTitle: 28, // 656:18 → 645:60
  },
  atsChecking: {
    source: require('../../../../assets/illustrations/ats/ats-checking.png'),
    w: 270,
    h: 210,
    shiftX: 0,
    toTitle: 36, // 656:22 → 646:13
    live: {
      px: { w: 810, h: 630 },
      sparkles: [
        { x: 704, y: 102, size: 86 },
        { x: 759.5, y: 166.5, size: 60 },
        { x: 49.5, y: 403, size: 78 },
      ],
      // The front page, inside its edges; it leans a few degrees back.
      page: { x: 395, y: 310, w: 400, h: 450, angle: -5 },
    },
  },
  tailorWriting: {
    source: require('../../../../assets/illustrations/tailor/tailor-writing.png'),
    w: 255,
    h: 195,
    shiftX: -3.5, // 661:40 sits at x 64
    toTitle: 20, // 661:40 → 608:210 (608:209's spacer)
    live: ROBOT_PAGE,
  },
  buildJob: {
    source: require('../../../../assets/illustrations/build/build-job.png'),
    w: 255,
    h: 150,
    shiftX: 0,
    toTitle: 36, // 661:26 → 652:13
  },
  buildChoose: {
    source: require('../../../../assets/illustrations/build/build-choose.png'),
    w: 255,
    h: 162,
    shiftX: 0,
    toTitle: 13, // 661:28 → 652:87
  },
  buildAdd: {
    source: require('../../../../assets/illustrations/build/build-add.png'),
    w: 255,
    h: 165,
    shiftX: 24.5, // 661:30 sits at x 92: the link badge carries the drawing right
    toTitle: 31, // 661:30 → 653:13
  },
  buildRead: {
    source: require('../../../../assets/illustrations/build/build-read.png'),
    w: 255,
    h: 175,
    shiftX: 7.5, // 661:32 at x 75
    toTitle: 20, // 661:32 → 653:67
  },
  buildWriting: {
    source: require('../../../../assets/illustrations/build/build-writing.png'),
    w: 255,
    h: 195,
    shiftX: -6.5, // 661:34 at x 61
    toTitle: 34, // 661:34 → 653:135
    live: ROBOT_PAGE,
  },
  buildUnreadable: {
    source: require('../../../../assets/illustrations/build/build-unreadable.png'),
    w: 255,
    h: 168.3,
    shiftX: 0,
    toTitle: 41.7, // 661:36 → 653:197
  },
  interviewSets: {
    source: require('../../../../assets/illustrations/interview/interview-sets.png'),
    w: 255,
    h: 165,
    shiftX: 0,
    toTitle: 7, // 674:17 → 577:955
  },
  interviewNew: {
    source: require('../../../../assets/illustrations/interview/interview-new.png'),
    w: 255,
    h: 160,
    shiftX: 0,
    toTitle: 14, // 674:18 → 577:1889
  },
  assistantFirstRun: {
    source: require('../../../../assets/illustrations/assistant/assistant-first-run.png'),
    w: 255,
    h: 216,
    shiftX: 0,
    toTitle: 32, // 674:85 → 577:7824
  },
} satisfies Record<string, FlowArt>;

// Hero text on the flow boards at 390 (COVER 644:29, ZERO 613:244, ATS 645:14), in artboard units.
const TITLE_TO_LEDE = 8 / 0.75;

export type FlowHeroProps = {
  title: string;
  lede: string;
  /** COVER 03 and ZERO 03 draw none, so the title leads. */
  art?: FlowArt;
  /**
   * Text boxes narrower than the page, at 390, where a board sets its line breaks that way
   * (ASSISTANT 02: the title at 250, 577:7824; the lede at 318, 577:7826). Centred.
   */
  titleWidth?: number;
  ledeWidth?: number;
  /**
   * What a run is doing to the drawing, for art that carries `live` anchors: `scan` while it
   * reads a page (analysis), `write` while it writes one. Static flows pass nothing.
   */
  motif?: LiveMotif;
  /** The run is working right now; off, the motion settles and the art rests. */
  active?: boolean;
};

/**
 * The top of a flow screen (COVER, ZERO and ATS boards): the board's illustration, then the
 * screen's own name and one line on what happens here. The header row leaves its title slot
 * empty, so this title carries the page's header role. The drawing is decoration, hidden from
 * readers.
 */
export function FlowHero({
  title,
  lede,
  art,
  titleWidth,
  ledeWidth,
  motif,
  active = false,
}: FlowHeroProps) {
  const { motion, spacing, s } = useTheme();
  const styles = useStyles();
  const live = motif != null && art?.live != null;
  // The drawing breathes while the run works: up a little and back, once per `loops.float`.
  const breath = useLoop(live && active, motion.loops.float);
  const rise = spacing[1];
  const float = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.sin(2 * Math.PI * breath.value) * rise }],
  }));

  return (
    <View style={styles.hero}>
      {art ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: s(art.w / 0.75),
            height: s(art.h / 0.75),
            marginBottom: s(art.toTitle / 0.75),
            transform: [{ translateX: s(art.shiftX / 0.75) }],
          }}
        >
          <Animated.View style={[styles.fill, live ? float : null]}>
            <Image
              source={art.source}
              contentFit="contain"
              // Decodes off the main thread and often lands mid-push: fade it in rather than pop
              // it, and keep it decoded so a revisit paints it in the first frame.
              transition={motion.durations.imageFade}
              cachePolicy="memory-disk"
              accessible={false}
              style={styles.fill}
            />
            {live && art.live && motif ? (
              <LiveArt anchors={art.live} motif={motif} active={active} width={s(art.w / 0.75)} />
            ) : null}
          </Animated.View>
        </View>
      ) : null}
      <Text
        variant="headlineLg"
        align="center"
        style={[styles.text, titleWidth != null ? narrow(s(titleWidth / 0.75)) : null]}
        {...a11yHeader(title)}
      >
        {title}
      </Text>
      <Text
        variant="captionRegular"
        color="textSecondary"
        align="center"
        style={[styles.lede, ledeWidth != null ? narrow(s(ledeWidth / 0.75)) : null]}
      >
        {lede}
      </Text>
    </View>
  );
}

/** A stretched child ignores centring once clamped, so a narrowed box is centred explicitly. */
const narrow = (maxWidth: number) => ({
  alignSelf: 'center' as const,
  width: '100%' as const,
  maxWidth,
});

const useStyles = scaledSheet((s) => ({
  hero: { alignItems: 'center' },
  fill: { width: '100%', height: '100%' },
  text: { alignSelf: 'stretch' },
  lede: { alignSelf: 'stretch', marginTop: s(TITLE_TO_LEDE) },
}));
