import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { board } from '../board';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

/** Figma 307:4290 — the copy column, and the row "Skip" sits in above it. */
const LAYOUT = {
  top: 41,
  skipHeight: 25,
  copyTop: 43,
  gap: 15.3,
  headingTop: 13.06,
  left: 43,
  right: 32,
};

export type OnboardingSlideProps = {
  /** 1-based, rendered as "n / 3" with the total greyed back. */
  step: number;
  total: number;
  title: string;
  lead: string;
  /** Omitted on the last slide, which offers "Get Started" instead. */
  onSkip?: () => void;
  /**
   * Slides 1 and 2 sit a single drawing on the floor. Slide 3 stacks two things — the feature
   * cards and the illustration — and the board puts the cards under the copy and the drawing
   * hard against the bottom bar, which is `space-between` and not either end.
   */
  illustrationAlign?: 'flex-start' | 'flex-end' | 'space-between';
  illustrationGap?: number;
  /** Slide 3 is redrawn on a tighter leading than slides 1 and 2 (25.448 against 27.55). */
  leadVariant?: 'onboardingLead' | 'onboardingLeadTight';
  width: number;
  children: ReactNode;
};

/** The chrome every onboarding slide shares (Figma 307:4165 / 307:4217 / 307:4288). */
export function OnboardingSlide({
  step,
  total,
  title,
  lead,
  onSkip,
  illustrationAlign = 'flex-end',
  illustrationGap = 0,
  leadVariant = 'onboardingLead',
  width,
  children,
}: OnboardingSlideProps) {
  const { s } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.slide,
        {
          width,
          paddingTop: Math.max(s(board(LAYOUT.top)), insets.top),
          paddingLeft: s(board(LAYOUT.left)),
          paddingRight: s(board(LAYOUT.right)),
        },
      ]}
    >
      <View style={[styles.skipRow, { height: s(board(LAYOUT.skipHeight)) }]}>
        {onSkip ? (
          <Pressable
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Skip"
            accessibilityHint="Goes straight to creating an account"
            onPress={onSkip}
          >
            <Text variant="onboardingLead" color="textTertiary">
              Skip
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ paddingTop: s(board(LAYOUT.copyTop)), gap: s(board(LAYOUT.gap)) }}>
        <Text variant="onboardingStep" color="onboardingInk">
          {`${step} `}
          <Text variant="onboardingStepTotal" color="onboardingStepMuted">
            {`/ ${total}`}
          </Text>
        </Text>
        <View
          accessible
          {...a11yHeader(title.replace('\n', ' '))}
          style={{ marginTop: s(board(LAYOUT.headingTop)) }}
        >
          <Text variant="onboardingTitle" color="onboardingInk">
            {title}
          </Text>
        </View>
        <Text variant={leadVariant} color="onboardingBody">
          {lead}
        </Text>
      </View>

      <View
        style={[
          styles.art,
          { justifyContent: illustrationAlign, paddingTop: s(board(illustrationGap)) },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  slide: { flex: 1 },
  skipRow: { alignItems: 'flex-end', justifyContent: 'center' },
  art: { flex: 1, alignItems: 'center' },
}));
