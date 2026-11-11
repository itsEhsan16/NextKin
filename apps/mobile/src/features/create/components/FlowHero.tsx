import { Image, type ImageProps } from 'expo-image';
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';
import { useLoop } from '@/ui/motion';

import { LiveArt, type LiveAnchors, type LiveMotif } from './LiveArt';

/**
 * The flow illustrations (owner, 2026-11-11, §211: the clay set made on Seedream 5.5), each fitted
 * inside the box its board drew, at 390, and how far its title stands below it. The live run art
 * keeps its float while a run works; the glints, scan and ink were traced on the old drawings, so
 * they wait for anchors measured on these.
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

export const FLOW_ART = {
  coverSetup: {
    source: require('../../../../assets/illustrations/cover/cover-setup.webp'),
    w: 255,
    h: 187,
    shiftX: 0,
    toTitle: 19, // 656:60 → 644:29
  },
  coverWriting: {
    source: require('../../../../assets/illustrations/cover/cover-writing.webp'),
    w: 269,
    h: 180.6,
    shiftX: 0,
    toTitle: 16, // 656:51 → 644:111
    live: { px: { w: 1080, h: 725 }, sparkles: [] },
  },
  zeroAbout: {
    source: require('../../../../assets/illustrations/zero/zero-about.webp'),
    w: 255,
    h: 137.7,
    shiftX: 0,
    toTitle: 14, // 661:25 → 613:246
  },
  zeroWriting: {
    source: require('../../../../assets/illustrations/zero/zero-writing.webp'),
    w: 263,
    h: 158.8,
    shiftX: 0,
    toTitle: 10, // 661:14 → 613:322
    live: { px: { w: 1080, h: 652 }, sparkles: [] },
  },
  atsUpload: {
    source: require('../../../../assets/illustrations/ats/ats-upload.webp'),
    w: 197,
    h: 135,
    shiftX: 0,
    toTitle: 29, // 656:14 → 645:14
  },
  atsPaste: {
    source: require('../../../../assets/illustrations/ats/ats-paste.webp'),
    w: 171.5,
    h: 159,
    shiftX: 0,
    toTitle: 28, // 656:18 → 645:60
  },
  atsChecking: {
    source: require('../../../../assets/illustrations/ats/ats-checking.webp'),
    w: 270,
    h: 172,
    shiftX: 0,
    toTitle: 36, // 656:22 → 646:13
    live: { px: { w: 1080, h: 688 }, sparkles: [] },
  },
  tailorWriting: {
    source: require('../../../../assets/illustrations/tailor/tailor-writing.webp'),
    w: 255,
    h: 165.5,
    shiftX: 0,
    toTitle: 20, // 661:40 → 608:210 (608:209's spacer)
    live: { px: { w: 1080, h: 701 }, sparkles: [] },
  },
  buildJob: {
    source: require('../../../../assets/illustrations/build/build-job.webp'),
    w: 248.5,
    h: 150,
    shiftX: 0,
    toTitle: 36, // 661:26 → 652:13
  },
  buildChoose: {
    source: require('../../../../assets/illustrations/build/build-choose.webp'),
    w: 255,
    h: 156.8,
    shiftX: 0,
    toTitle: 13, // 661:28 → 652:87
  },
  buildAdd: {
    source: require('../../../../assets/illustrations/build/build-add.webp'),
    w: 255,
    h: 162.9,
    shiftX: 0,
    toTitle: 31, // 661:30 → 653:13
  },
  buildRead: {
    source: require('../../../../assets/illustrations/build/build-read.webp'),
    w: 253.7,
    h: 175,
    shiftX: 0,
    toTitle: 20, // 661:32 → 653:67
  },
  buildWriting: {
    source: require('../../../../assets/illustrations/build/build-writing.webp'),
    w: 190.1,
    h: 195,
    shiftX: 0,
    toTitle: 34, // 661:34 → 653:135
    live: { px: { w: 1080, h: 1108 }, sparkles: [] },
  },
  buildUnreadable: {
    source: require('../../../../assets/illustrations/build/build-unreadable.webp'),
    w: 234.8,
    h: 168.3,
    shiftX: 0,
    toTitle: 41.7, // 661:36 → 653:197
  },
  interviewSets: {
    source: require('../../../../assets/illustrations/interview/interview-sets.webp'),
    w: 255,
    h: 164.3,
    shiftX: 0,
    toTitle: 7, // 674:17 → 577:955
  },
  interviewNew: {
    source: require('../../../../assets/illustrations/interview/interview-new.webp'),
    w: 255,
    h: 150.4,
    shiftX: 0,
    toTitle: 14, // 674:18 → 577:1889
  },
  assistantFirstRun: {
    source: require('../../../../assets/illustrations/assistant/assistant-first-run.webp'),
    w: 255,
    h: 190.8,
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
