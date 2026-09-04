import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';

import { APPLICATION_TONE, type Application, type MatchBand } from '@/data/models';
import { MATCH_BAND_LABEL } from '@/data/models';
import { formatDaysAgo, formatWeekdayDate } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { Text } from '@/ui/Text';

type Tone = 'neutral' | 'status' | 'success' | 'warning' | 'danger' | 'outline';

const TONES: Record<Tone, { bg: ColorToken | 'transparent'; fg: ColorToken; border?: ColorToken }> =
  {
    neutral: { bg: 'surfaceSubtle', fg: 'textSecondary' },
    /** Same grey chip as `neutral`, but the darker #4B5563 label the status pill uses (Figma 1:557/1:583). */
    status: { bg: 'surfaceSubtle', fg: 'textBody' },
    success: { bg: 'successSurface', fg: 'success' },
    warning: { bg: 'warningSurface', fg: 'warningStrong' },
    danger: { bg: 'dangerSurface', fg: 'danger' },
    outline: { bg: 'transparent', fg: 'textSecondary', border: 'borderDefault' },
  };

type JobPillProps = {
  label: string;
  tone?: Tone;
  strong?: boolean;
  /** FA5 Solid glyph rendered before the label in the pill's own colour. */
  icon?: string;
  iconSize?: number;
};

/** Figma pill: fully rounded, 13/5 padding, 13/20 label. */
function JobPill({ label, tone = 'neutral', strong = false, icon, iconSize = 7 }: JobPillProps) {
  const { colors, radii, spacing, s } = useTheme();
  const look = TONES[tone];

  return (
    <View
      style={[
        styles.pill,
        {
          borderRadius: radii.full,
          paddingHorizontal: s(13),
          paddingVertical: s(5),
          gap: spacing[1] + 2,
          backgroundColor: look.bg === 'transparent' ? 'transparent' : colors[look.bg],
          borderWidth: look.border ? 1 : 0,
          borderColor: look.border ? colors[look.border] : 'transparent',
        },
      ]}
    >
      {icon ? <FontAwesome5 name={icon} size={iconSize} color={colors[look.fg]} solid /> : null}
      <Text variant={strong ? 'captionSemiBold' : 'captionRegular'} color={look.fg}>
        {label}
      </Text>
    </View>
  );
}

const MATCH_TONE: Record<MatchBand, Tone> = {
  strong: 'success',
  good: 'warning',
  fair: 'neutral',
};

export function MatchPill({ band }: { band: MatchBand }) {
  return <JobPill label={MATCH_BAND_LABEL[band]} tone={MATCH_TONE[band]} strong />;
}

export function MetaPill({ label }: { label: string }) {
  return <JobPill label={label} />;
}

/** "Closing in 3d" — urgency on a saved job whose deadline is near (Figma 1:428). */
export function ClosingPill({ label }: { label: string }) {
  return <JobPill label={label} tone="warning" strong />;
}

/** Bordered "Applied 12d ago" pill on the Applied tab (Figma 1:547). */
export function AppliedAgePill({ appliedAt }: { appliedAt: string }) {
  return <JobPill label={`Applied ${formatDaysAgo(appliedAt)}`} tone="outline" />;
}

/**
 * The neutral application status reads darker than a plain meta pill ("Full-time", "2d ago"),
 * so it maps to `status` (#4B5563) rather than sharing `neutral`'s #6B7280.
 */
const STATUS_TONE = { neutral: 'status', success: 'success', warning: 'warning', danger: 'danger' } as const;

/** Application status with its leading dot (Figma 1:541) — copy exactly as the artboard words it. */
export function applicationStatusLabel(application: Application): string {
  switch (application.status) {
    case 'interview':
      return application.interviewAt
        ? `Interview · ${formatWeekdayDate(application.interviewAt)}`
        : 'Interview';
    case 'viewed':
      return 'Applied · Viewed';
    case 'in_review':
      return 'In review';
    case 'applied':
      return 'Applied';
    case 'offer':
      return 'Offer';
    case 'not_selected':
      return 'Not selected';
    case 'withdrawn':
      return 'Withdrawn';
  }
}

export function ApplicationStatusPill({ application }: { application: Application }) {
  return (
    <JobPill
      label={applicationStatusLabel(application)}
      tone={STATUS_TONE[APPLICATION_TONE[application.status]]}
      strong
      icon="circle"
    />
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
