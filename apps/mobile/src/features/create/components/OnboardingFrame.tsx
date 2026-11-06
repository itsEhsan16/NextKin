import type { ReactNode } from 'react';
import { View } from 'react-native';

import { a11yHeader } from '@/lib';
import { scaledSheet } from '@/theme';
import { GradientWash } from '@/ui/GradientWash';
import { IconButton } from '@/ui/IconButton';
import { Pressable } from '@/ui/Pressable';
import { Screen } from '@/ui/Screen';
import { StepProgress } from '@/ui/StepProgress';
import { Text } from '@/ui/Text';

export type OnboardingFrameProps = {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onSkip?: () => void;
  /** Shows a close ✕ in Skip's place — for flows the user can leave at any step. */
  onClose?: () => void;
  /** Something between the title and the step, e.g. the "Building from" pill. */
  aside?: ReactNode;
  /** An illustration above the title (Zero's empty page, §173). */
  art?: ReactNode;
  /** Pinned at the bottom: the step's primary button. */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * The frame for the steps right after sign-up (§172): back, a progress bar and Skip on one row,
 * then a big title, one line, the step, and its button pinned at the bottom.
 */
export function OnboardingFrame({
  step,
  total,
  title,
  subtitle,
  onBack,
  onSkip,
  onClose,
  aside,
  art,
  footer,
  children,
}: OnboardingFrameProps) {
  const styles = useStyles();
  return (
    <Screen
      keyboard
      scroll
      edges={['top', 'bottom']}
      padded={false}
      footer={footer ? <View style={styles.footer}>{footer}</View> : undefined}
    >
      <GradientWash depth={0.35} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          {onBack ? (
            <IconButton icon="ArrowLeft" label="Go back" variant="outline" onPress={onBack} />
          ) : (
            <View style={styles.backSpace} />
          )}
          <View style={styles.progress}>
            <StepProgress step={step} total={total} />
          </View>
          {onClose ? (
            <IconButton icon="XClose" label="Close" variant="outline" onPress={onClose} />
          ) : onSkip ? (
            <Pressable
              feedback="subtle"
              accessibilityRole="button"
              accessibilityLabel="Skip"
              onPress={onSkip}
              style={styles.skip}
            >
              <Text variant="bodySemiBold" color="textSecondary">
                Skip
              </Text>
            </Pressable>
          ) : (
            <View style={styles.backSpace} />
          )}
        </View>
        {art ? <View style={styles.art}>{art}</View> : null}
        <View
          accessible
          {...a11yHeader(title)}
          style={[styles.heading, art ? styles.headingAfterArt : null]}
        >
          <Text variant="title1" color="ink">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodyLg" color="textSecondary">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {aside ? <View style={styles.aside}>{aside}</View> : null}
        {children}
      </View>
    </Screen>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  body: { paddingHorizontal: u(24), paddingTop: u(8), paddingBottom: u(24) },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: u(16) },
  backSpace: { width: u(44), height: u(44) },
  progress: { flex: 1 },
  skip: { minWidth: u(44), height: u(44), alignItems: 'flex-end', justifyContent: 'center' },
  heading: { marginTop: u(28), marginBottom: u(24), gap: u(8) },
  aside: { marginTop: -u(8), marginBottom: u(20) },
  art: { marginTop: u(16) },
  headingAfterArt: { marginTop: u(12) },
  footer: { paddingHorizontal: u(24), paddingTop: u(12), paddingBottom: u(8) },
}));
