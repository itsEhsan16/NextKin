import { Image, type ImageSource } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

import { OnboardingFrame } from '../components/OnboardingFrame';
import { firstResumeAsked } from '../firstResume';

export const FIRST_RESUME_TITLE = 'Add your resume';
export const FIRST_RESUME_LEDE = 'Start from yours, or let AI draft one.';
export const FIRST_RESUME_UPLOAD = 'Upload my resume';
export const FIRST_RESUME_NONE = 'Start from scratch';

/** Shared with Home's first-resume pop-up (§185), so both ask the same way. */
export const FIRST_RESUME_ART = {
  upload: require('../../../../assets/illustrations/redesign/job-match.webp') as ImageSource,
  scratch: require('../../../../assets/illustrations/redesign/empty-resume.webp') as ImageSource,
};

export function FirstResumeOption({
  title,
  body,
  art,
  badge,
  onPress,
}: {
  title: string;
  body: string;
  art: ImageSource;
  badge?: string;
  onPress: () => void;
}) {
  const { colors, shadows } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={body}
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: colors.surfaceCard, borderColor: colors.borderSoft },
        shadows.soft,
      ]}
    >
      <View style={[styles.art, { backgroundColor: colors.brandSurface }]}>
        <Image source={art} style={styles.artImage} contentFit="contain" />
      </View>
      <View style={styles.text}>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: colors.brandSurface }]}>
            <Text variant="eyebrow" color="brand">
              {badge}
            </Text>
          </View>
        ) : null}
        <Text variant="title3" color="ink">
          {title}
        </Text>
        <Text variant="callout" color="textSecondary">
          {body}
        </Text>
      </View>
      <Icon name="ChevronRight" size="sm" color={colors.iconMuted} />
    </Pressable>
  );
}

/**
 * Step 2 of 2 after sign-up (toreview.md §172): upload a resume, or start from scratch. Two big
 * choices and a Skip. Reaching this screen IS the question (§186): whatever they choose, Skip
 * included, Home never asks it again; the flows that need a resume ask at that point instead.
 */
export function FirstResumeScreen() {
  const router = useRouter();
  const styles = useStyles();
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  useEffect(() => firstResumeAsked.markAsked(), []);

  return (
    <OnboardingFrame
      step={2}
      total={2}
      title={FIRST_RESUME_TITLE}
      subtitle={FIRST_RESUME_LEDE}
      onBack={() => router.replace('/create/setup')}
      onSkip={leave}
    >
      <View style={styles.options}>
        <FirstResumeOption
          title={FIRST_RESUME_UPLOAD}
          body="PDF or DOCX. We’ll read it for you."
          art={FIRST_RESUME_ART.upload}
          badge="FASTEST"
          onPress={() => router.replace({ pathname: '/create/upload', params: { next: 'job' } })}
        />
        <FirstResumeOption
          title={FIRST_RESUME_NONE}
          body="Answer 3 questions, get a draft."
          art={FIRST_RESUME_ART.scratch}
          onPress={() => router.replace('/create/zero-resume')}
        />
      </View>
    </OnboardingFrame>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  options: { gap: u(14) },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(14),
    padding: u(14),
    borderRadius: u(24),
    borderWidth: 1,
  },
  art: {
    width: u(76),
    height: u(76),
    borderRadius: u(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  artImage: { width: u(68), height: u(68) },
  text: { flex: 1, gap: u(4) },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: u(8),
    paddingVertical: u(2),
    borderRadius: u(999),
    marginBottom: u(2),
  },
}));
