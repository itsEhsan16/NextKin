import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { resolveImageSource } from '@/assets';
import type { Resume } from '@/data/models';
import { a11yButton, formatPercent, formatRelativeTimeLong } from '@/lib';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { ProgressBar, ScoreRing } from '@/ui/Progress';
import { SectionHeader } from '@/ui/SectionHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';

export type ResumeProgressCardProps = {
  resume: Resume | undefined;
  status: 'pending' | 'error' | 'success';
  onViewAll: () => void;
  onPressResume: (resume: Resume) => void;
  onCreateResume: () => void;
  onRetry: () => void;
};

const THUMB = { width: 80, height: 96 } as const;
const RING = 80;

const CHECKS: readonly { key: keyof NonNullable<Resume['validation']>; label: string }[] = [
  { key: 'timelineValid', label: 'Timeline Valid' },
  { key: 'atsOptimized', label: 'ATS Optimized' },
  { key: 'jdMatched', label: 'JD Matched' },
];

/**
 * One accessible label for the whole row: the meters inside are collapsed by the parent
 * Pressable, so their values have to travel here or a screen reader never hears them.
 */
function resumeSummary(resume: Resume): string {
  const parts = [resume.title];
  if (resume.completeness != null) parts.push(`${formatPercent(resume.completeness)} complete`);
  if (resume.atsScore != null) parts.push(`ATS score ${resume.atsScore}`);
  parts.push(`last updated ${formatRelativeTimeLong(resume.updatedAt)}`);
  return parts.join(', ');
}

/** Figma 1:154 — latest resume: thumbnail, title, freshness, completeness bar, ATS ring, checks. */
export function ResumeProgressCard({
  resume,
  status,
  onViewAll,
  onPressResume,
  onCreateResume,
  onRetry,
}: ResumeProgressCardProps) {
  const { colors, radii, spacing, s } = useTheme();
  const thumb = { width: s(THUMB.width), height: s(THUMB.height) };
  const ring = s(RING);
  // Resolve once: for a remote URL this allocates a new { uri } object per call, which would
  // make expo-image re-run its source-change path on every parent render.
  const thumbSource = useMemo(
    () => resolveImageSource(resume?.thumbnailUrl),
    [resume?.thumbnailUrl],
  );

  return (
    <Card style={{ paddingVertical: s(25), paddingHorizontal: s(21), gap: spacing[4] }}>
      <SectionHeader title="Your Resume Progress" variant="sectionBold" onAction={onViewAll} />

      {status === 'pending' ? (
        <View style={[styles.row, { gap: spacing[4] }]}>
          <Skeleton width={thumb.width} height={thumb.height} radius="xs" />
          <View style={{ flex: 1, gap: spacing[2] }}>
            <Skeleton width="70%" height={s(20)} />
            <Skeleton width="50%" height={s(14)} />
            <Skeleton height={s(8)} radius="full" style={{ marginTop: spacing[2] }} />
          </View>
          <Skeleton width={ring} height={ring} radius="full" />
        </View>
      ) : status === 'error' ? (
        <StateView
          compact
          tone="danger"
          icon="exclamation-triangle"
          title="Couldn't load your resumes"
          actionLabel="Try again"
          onAction={onRetry}
        />
      ) : !resume ? (
        <StateView
          compact
          icon="file-alt"
          title="No resume yet"
          message="Generate your first JD-tailored resume in under a minute."
          actionLabel="Create resume"
          onAction={onCreateResume}
        />
      ) : (
        <>
          <Pressable
            {...a11yButton(resumeSummary(resume))}
            feedback="subtle"
            haptic="light"
            onPress={() => onPressResume(resume)}
            style={[styles.row, { gap: spacing[4] }]}
          >
            <View
              style={{
                width: thumb.width,
                height: thumb.height,
                borderRadius: radii.xs,
                borderWidth: s(1),
                borderColor: colors.borderDefault,
                overflow: 'hidden',
                backgroundColor: colors.surfaceSubtle,
              }}
            >
              {thumbSource ? (
                <Image
                  source={thumbSource}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  recyclingKey={resume.thumbnailUrl}
                />
              ) : null}
            </View>

            <View style={{ flex: 1 }}>
              <Text variant="label" numberOfLines={1}>
                {resume.title}
              </Text>
              <Text variant="captionRegular" color="textSecondary" numberOfLines={1}>
                Last updated {formatRelativeTimeLong(resume.updatedAt)}
              </Text>
              <ProgressBar
                value={resume.completeness ?? 0}
                accessibilityLabel="Resume completeness"
                style={{ marginTop: s(13) }}
              />
            </View>

            {resume.atsScore != null ? (
              <ScoreRing score={resume.atsScore} label="ATS Score" size={ring} />
            ) : null}
          </Pressable>

          {resume.validation ? (
            <View style={[styles.checks, { gap: spacing[4] }]}>
              {CHECKS.map(({ key, label }) => {
                const ok = resume.validation?.[key] ?? false;
                return (
                  <View
                    key={key}
                    accessible
                    accessibilityLabel={`${label}: ${ok ? 'passed' : 'pending'}`}
                    style={[styles.row, { gap: s(4) }]}
                  >
                    <FontAwesome5
                      name={ok ? 'check-circle' : 'circle'}
                      size={s(13)}
                      color={ok ? colors.successIcon : colors.iconMuted}
                      solid={ok}
                    />
                    <Text variant="captionRegular" color="textBody">
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  checks: { flexDirection: 'row', flexWrap: 'wrap' },
});
