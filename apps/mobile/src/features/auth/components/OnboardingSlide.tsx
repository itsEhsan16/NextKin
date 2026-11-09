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
  leadVariant?: 'bodyLg';
  /**
   * The share of `largeTitle` every slide's title is drawn at (§206): one number for all three,
   * the one that fits the longest drawn line, so a narrow phone shrinks them together instead of
   * wrapping one to a third line. Undefined until measured: the title waits, invisible.
   */
  titleFit?: number;
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
  leadVariant = 'bodyLg',
  titleFit,
  width,
  children,
}: OnboardingSlideProps) {
  const { s, typography } = useTheme();
  const role = typography.largeTitle;
  const fitted =
    titleFit === undefined
      ? { opacity: 0 }
      : titleFit < 1
        ? {
            fontSize: (role.fontSize ?? 0) * titleFit,
            lineHeight: (role.lineHeight ?? 0) * titleFit,
            letterSpacing: (role.letterSpacing ?? 0) * titleFit,
          }
        : undefined;
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
            accessibilityRole="button"
            accessibilityLabel="Skip"
            accessibilityHint="Goes straight to creating an account"
            onPress={onSkip}
          >
            <Text variant="bodyLg" color="textTertiary">
              Skip
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ paddingTop: s(board(LAYOUT.copyTop)), gap: s(board(LAYOUT.gap)) }}>
        <Text variant="title1" color="onboardingInk">
          {`${step} `}
          <Text variant="title1" color="onboardingStepMuted">
            {`/ ${total}`}
          </Text>
        </Text>
        <View
          accessible
          {...a11yHeader(title.replace('\n', ' '))}
          style={{ marginTop: s(board(LAYOUT.headingTop)) }}
        >
          {/* Every slide's title is its two drawn lines (§206), at one size shared by all three. */}
          <Text variant="largeTitle" color="onboardingInk" maxFontSizeMultiplier={1} style={fitted}>
            {title}
          </Text>
        </View>
        <Text variant={leadVariant} color="onboardingBody" maxFontSizeMultiplier={1}>
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
