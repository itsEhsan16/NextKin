import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ScrollView,
  useWindowDimensions,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ResumeDesk from '../../../../assets/onboarding/resume-desk.svg';
import { board } from '../board';
import { BrighterAhead } from '../components/BrighterAhead';
import { FeatureRows } from '../components/FeatureRows';
import { JobCardStack } from '../components/JobCardStack';
import { NextFab } from '../components/NextFab';
import { OnboardingSlide } from '../components/OnboardingSlide';
import { SlideDots } from '../components/SlideDots';
import { useOnboardingStore } from '../onboardingStore';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Icon, glyphSpan } from '@/ui/Icon';

/**
 * Figma 307:4175 / 307:4281 (slides 1-2) and 309:2 (slide 3) — one bar, drawn twice.
 *
 * The redraw brought slide 3 onto the same bar as the other two: 72 tall, 41 off the floor, 14pt
 * dots 17 apart. Only the gutters still differ, by 3, and the last slide swaps the round arrow
 * for a labelled pill that fills the bar's own height.
 */
const BAR = { bottom: 41, height: 72, dot: 14, dotGap: 17 };
const GUTTER = { left: 42, right: 35 };
const LAST_GUTTER = { left: 39, right: 38 };
const CTA = { width: 189, gap: 12.794, arrow: 26 };
const DESK = { width: 375.53, height: 344 };

/** Where slide 3's cards start, measured from the bottom of the copy column (317.66 to 337.65). */
const CARDS_TOP = 19.98862;

const SLIDES = [
  {
    title: 'Create a resume\nthat stands out.',
    lead: 'Use AI to create a professional,\ntailored resume in minutes.',
  },
  {
    title: 'Discover jobs\nthat match you.',
    lead: 'Get personalized job recommendations\nfrom top companies.',
  },
  {
    title: 'Take the next\nstep with confidence.',
    lead: 'Apply faster, track your progress,\nand get closer to your dream career.',
  },
] as const;

/**
 * The three first-run slides (Figma 307:4165, 307:4217, 307:4288).
 *
 * Static content, so this screen has no loading, empty or error state to ship: nothing is
 * fetched, and the three slides are drawn copy rather than data. The bottom bar is lifted out of
 * the pager and rendered once, so the dots can follow the scroll instead of three separate bars
 * sliding past each other — and because slide 3 replaces the arrow with a labelled button.
 */
export function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors, radii, shadows, s } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const markSeen = useOnboardingStore((state) => state.markSeen);
  const scroller = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);

  const finish = () => {
    markSeen();
    router.replace('/(auth)/get-started');
  };

  const advance = () => scroller.current?.scrollTo({ x: width * (index + 1), animated: true });

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const last = index === SLIDES.length - 1;
  const gutter = last ? LAST_GUTTER : GUTTER;

  return (
    <Screen edges={[]} padded={false}>
      <ScrollView
        ref={scroller}
        testID="onboarding-pager"
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.fill}
      >
        {SLIDES.map(({ title, lead }, slide) => (
          <OnboardingSlide
            key={title}
            step={slide + 1}
            total={SLIDES.length}
            title={title}
            lead={lead}
            width={width}
            onSkip={slide === SLIDES.length - 1 ? undefined : finish}
            illustrationAlign={slide === 2 ? 'space-between' : 'flex-end'}
            illustrationGap={slide === 2 ? CARDS_TOP : 0}
            leadVariant={slide === 2 ? 'onboardingLeadTight' : 'onboardingLead'}
          >
            {slide === 0 ? (
              <ResumeDesk width={s(board(DESK.width))} height={s(board(DESK.height))} />
            ) : null}
            {slide === 1 ? <JobCardStack /> : null}
            {/* Two children, so the slot's `space-between` can hold the drawing on the floor. */}
            {slide === 2 ? <FeatureRows /> : null}
            {slide === 2 ? <BrighterAhead /> : null}
          </OnboardingSlide>
        ))}
      </ScrollView>

      <View
        style={[
          styles.bar,
          {
            height: s(board(BAR.height)),
            paddingLeft: s(board(gutter.left)),
            paddingRight: s(board(gutter.right)),
            marginBottom: Math.max(s(board(BAR.bottom)), insets.bottom),
          },
        ]}
      >
        <SlideDots count={SLIDES.length} index={index} size={BAR.dot} gap={BAR.dotGap} />

        {last ? (
          <Pressable
            haptic="medium"
            accessibilityRole="button"
            accessibilityLabel="Get Started"
            onPress={finish}
            style={[
              styles.cta,
              shadows.fab,
              {
                width: s(board(CTA.width)),
                height: s(board(BAR.height)),
                borderRadius: radii.full,
                backgroundColor: colors.onboardingInk,
                gap: s(board(CTA.gap)),
              },
            ]}
          >
            <Text variant="onboardingCta" color="textOnDark">
              Get Started
            </Text>
            {/* 309:8 is the same drawn glyph as the round button's — DM Sans Light 41 in a 31
                box — so it takes the same 26 `NextFab` renders it at. FontAwesome carries every
                other arrow in the app; a text node sized like an icon is not worth introducing. */}
            <Icon
              name="ArrowRight"
              size={s(board(CTA.arrow)) / glyphSpan.arrow}
              color={colors.textOnDark}
            />
          </Pressable>
        ) : (
          <NextFab onPress={advance} label={`Next, slide ${index + 2} of ${SLIDES.length}`} />
        )}
      </View>
    </Screen>
  );
}

const useStyles = scaledSheet(() => ({
  fill: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
}));
