import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';

import GoodSparkle from '../../../../assets/icons/jobs/match-sparkle-good.svg';
import StrongSparkle from '../../../../assets/icons/jobs/match-sparkle-strong.svg';
import { APPLICATION_TONE, type Application, type MatchBand } from '@/data/models';
import { MATCH_BAND_LABEL } from '@/data/models';
import { formatDaysAgo, formatWeekdayDate } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { Text } from '@/ui/Text';

type Tone = 'neutral' | 'status' | 'success' | 'warning' | 'danger' | 'outline';

const TONES: Record<Tone, { bg: ColorToken | 'transparent'; fg: ColorToken; border?: ColorToken }> =
  {
    neutral: { bg: 'surfaceSubtle', fg: 'textSecondary' },
    /**
     * Same grey chip as `neutral`, but the darker #4B5563 label (Figma 1:557/1:583). The status
     * pill was drawn this way first; the redrawn job cards give every tag the same pairing, which
     * is why `TagPill` below reaches for it too.
     */
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
  /** Glyph size in 520 space — scaled here, like every other length. 8 is the drawn 6pt dot. */
  iconSize?: number;
  /** Artwork rendered before the label, in place of an FA glyph — it carries its own colours. */
  leading?: ReactNode;
  /** FA5 Regular cut instead of Solid — the outline clock on Job Detail (Figma 443:117). */
  iconRegular?: boolean;
};

/** Figma pill: fully rounded, 13/5 padding, 13/20 label. */
function JobPill({
  label,
  tone = 'neutral',
  strong = false,
  icon,
  iconSize = 8,
  leading,
  iconRegular = false,
}: JobPillProps) {
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
      {leading}
      {icon ? (
        <FontAwesome5 name={icon} size={s(iconSize)} color={colors[look.fg]} solid={!iconRegular} />
      ) : null}
      <Text variant={strong ? 'captionSemiBold' : 'captionRegular'} color={look.fg}>
        {label}
      </Text>
    </View>
  );
}

// `weak` (C-10) has no board yet: it wears fair's neutral tone rather than a new colour.
const MATCH_TONE: Record<MatchBand, Tone> = {
  strong: 'success',
  good: 'warning',
  fair: 'neutral',
  weak: 'neutral',
};

/** `icon` is the signal-bars glyph Job Detail's redraw leads the pill with (Figma 443:119). */
export function MatchPill({ band, icon }: { band: MatchBand; icon?: string }) {
  return (
    <JobPill
      label={MATCH_BAND_LABEL[band]}
      tone={MATCH_TONE[band]}
      strong
      icon={icon}
      iconSize={MATCH_ICON}
    />
  );
}

/** 9.5 drawn. */
const MATCH_ICON = 12.6667;

/** The sparkle is drawn once per band, in that band's own colour (Figma 498:10 / 498:49). */
const BAND_SPARKLE: Partial<Record<MatchBand, (props: SvgProps) => React.ReactElement>> = {
  strong: (p) => <StrongSparkle {...p} />,
  good: (p) => <GoodSparkle {...p} />,
};

/** 15 × 14.59 drawn, inside a pill 22.5 tall. */
const SPARKLE = { w: 20, h: 19.4533 };

/**
 * The match pill as the redrawn job cards wear it (498:8): the same chip, with a sparkle before
 * the label.
 *
 * `fair` keeps the plain pill. The band exists in the model but no artboard has ever drawn it, so
 * there is no third sparkle to use and inventing one would be inventing a colour.
 */
export function MatchBadge({ band }: { band: MatchBand }) {
  const { s } = useTheme();
  const sparkle = BAND_SPARKLE[band];

  return (
    <JobPill
      label={MATCH_BAND_LABEL[band]}
      tone={MATCH_TONE[band]}
      strong
      leading={sparkle?.({ width: s(SPARKLE.w), height: s(SPARKLE.h) })}
    />
  );
}

export type MetaPillProps = { label: string; icon?: string; iconRegular?: boolean };

/** Grey meta chip. Job Detail's redraw leads each with a glyph, 10 drawn (Figma 443:116). */
export function MetaPill({ label, icon, iconRegular }: MetaPillProps) {
  return <JobPill label={label} icon={icon} iconRegular={iconRegular} iconSize={META_ICON} />;
}

const META_ICON = 13.3333;

/**
 * A fact about the job — location, workplace, employment type, salary — in the tag row the
 * redrawn cards put under the title (498:14). Darker label than `MetaPill`, as drawn.
 */
export function TagPill({ label, icon }: { label: string; icon?: string }) {
  return <JobPill label={label} tone="status" icon={icon} iconSize={TAG_ICON} />;
}

/** 9.5 drawn, on the carousel card's two tags only (519:20). */
const TAG_ICON = 12.6667;

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
const STATUS_TONE = {
  neutral: 'status',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
} as const;

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
