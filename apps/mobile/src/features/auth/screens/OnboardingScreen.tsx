import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ResumeDesk from '../../../../assets/onboarding/resume-desk.svg';
import { board } from '../board';
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

/** Figma 290:1024 (slides 1-2) and 296:2972 (slide 3) — the two bottom bars. */
const BAR = { left: 42, right: 35, bottom: 41, height: 72, dot: 14, dotGap: 17 };
const LAST_BAR = { left: 34, right: 23, bottom: 48.47, height: 59.53, dot: 12.756, dotGap: 11.693 };
const CTA = { width: 176.45, radius: 32.95, arrow: 22 };
const DESK = { width: 375.53, height: 344 };

const SLIDES = [
  { title: 'Create a resume\nthat stands out.', lead: 'Use AI to create a professional,\ntailored resume in minutes.' },
  { title: 'Discover jobs\nthat match you.', lead: 'Get personalized job recommendations\nfrom top companies.' },
  { title: 'Take the next\nstep with confidence.', lead: 'Apply faster, track your progress,\nand get closer to your dream career.' },
] as const;

/**
 * The three first-run slides (Figma 290:969, 290:1031, 295:2867).
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
  const scroller = useRef<ScrollView>(null);
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
  const bar = last ? LAST_BAR : BAR;

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
            illustrationAlign={slide === 2 ? 'flex-start' : 'flex-end'}
            illustrationGap={slide === 2 ? 43 : 0}
          >
            {slide === 0 ? <ResumeDesk width={s(board(DESK.width))} height={s(board(DESK.height))} /> : null}
            {slide === 1 ? <JobCardStack /> : null}
            {slide === 2 ? <FeatureRows /> : null}
          </OnboardingSlide>
        ))}
      </ScrollView>

      <View
        style={[
          styles.bar,
          {
            height: s(board(bar.height)),
            paddingLeft: s(board(bar.left)),
            paddingRight: s(board(bar.right)),
            marginBottom: Math.max(s(board(bar.bottom)), insets.bottom),
          },
        ]}
      >
        <SlideDots count={SLIDES.length} index={index} size={bar.dot} gap={bar.dotGap} />

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
                height: s(board(LAST_BAR.height)),
                borderRadius: radii.full,
                backgroundColor: colors.onboardingInk,
                gap: s(board(10)),
              },
            ]}
          >
            <Text variant="onboardingCta" color="textOnDark">
              Get Started
            </Text>
            <Text variant="onboardingCta" color="textOnDark">
              →
            </Text>
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
