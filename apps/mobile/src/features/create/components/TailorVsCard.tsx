import type { ReactNode } from 'react';
import { View } from 'react-native';

import { REMOTE_TYPE_LABEL, type Job, type Resume } from '@/data/models';
import { EntryTile, ProfileCard } from '@/features/profile/components/cards';
// Deep import on purpose: the resumes barrel drags its screens in.
import { ResumeThumbnail } from '@/features/resumes/components/ResumeThumbnail';
import { a11yButton, hitSlopFor, pluralize } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

/** The job side of the card: a listing, or a job description the user brought. */
export type VsTarget = { title: string; company?: string; meta: string };

export type TailorVsCardProps = {
  target: VsTarget;
  resume: Resume;
  /** Opens the resume picker (TAILOR 01) on the resume being compared. */
  onChange: () => void;
  /** "Details": the whole job as read, to check it (never a required step, §114). */
  onDetails?: () => void;
};

// "This job vs your resume" at 390 (TAILOR 02 607:35), in artboard units.
const ROW_PAD_X = 15 / 0.75;
const ROW_PAD_Y = 13 / 0.75;
const ROW_GAP = 12 / 0.75;
const SLOT = 40 / 0.75;
const THUMB_W = 32 / 0.75;
const THUMB_H = 40 / 0.75;
const THUMB_RADIUS = 5 / 0.75;
const TEXT_GAP = 1 / 0.75;
const RULE = 1 / 0.75;
const CHANGE_H = 30 / 0.75;
const CHANGE_PAD_X = 12 / 0.75;

/** "Stripe · Bengaluru · Remote" — the workplace is dropped when the location already says it. */
export function jobMetaLine(job: Job): string {
  const workplace = REMOTE_TYPE_LABEL[job.remote];
  const location = job.location.toLowerCase().includes(workplace.toLowerCase())
    ? [job.location]
    : [job.location, workplace];
  return [job.company, ...location].filter(Boolean).join(' · ');
}

/** "Base resume · 3 pages" — the kind and length only; the export formats are not the point here. */
export function resumeMetaLine(resume: Resume): string {
  return [
    resume.isBase ? 'Base resume' : 'Tailored',
    resume.pageCount != null ? pluralize(resume.pageCount, 'page') : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** One side of the comparison: the slot, eyebrow, title, meta and an optional pill. */
export function VsRow({
  leading,
  eyebrow,
  title,
  meta,
  trailing,
}: {
  leading: ReactNode;
  eyebrow: string;
  title: string;
  meta: string;
  trailing?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.slot}>{leading}</View>
      <View accessible accessibilityLabel={`${eyebrow}: ${title}, ${meta}`} style={styles.text}>
        <Text variant="micro" color="textSecondary" numberOfLines={1}>
          {eyebrow}
        </Text>
        <Text variant="titleSm" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="micro" color="textSecondary" numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {trailing}
    </View>
  );
}

/** The hairline between the two rows, inset to the rows' padding. */
export function VsRule() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.ruleRow}>
      <View style={[styles.rule, { backgroundColor: colors.divider }]} />
    </View>
  );
}

/** The grey pill at a row's end: Change on TAILOR 02, Edit on BUILD 04b (663:60). */
export function VsPill({
  label,
  spoken,
  hint,
  onPress,
}: {
  label: string;
  /** What a screen reader says: "Change resume", "Edit your profile". */
  spoken: string;
  hint: string;
  onPress: () => void;
}) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      {...a11yButton(spoken, hint)}
      feedback="scale"
      hitSlop={hitSlopFor(s(CHANGE_H))}
      onPress={onPress}
      style={[styles.change, { borderRadius: radii.full, backgroundColor: colors.surfaceSubtle }]}
    >
      <Text variant="captionSemiBold">{label}</Text>
    </Pressable>
  );
}

/**
 * The two things being compared (TAILOR 02): the job, with its company's letter tile and a Details
 * pill when its description can be corrected, and the resume, with a page thumbnail and a grey
 * Change pill that reopens the resume picker.
 */
export function TailorVsCard({ target, resume, onChange, onDetails }: TailorVsCardProps) {
  const { colors, sizes } = useTheme();
  const styles = useStyles();

  return (
    <ProfileCard>
      <VsRow
        leading={<EntryTile tile={{ kind: 'letter', name: target.company ?? target.title }} />}
        eyebrow="This job"
        title={target.title}
        meta={target.meta}
        trailing={
          onDetails ? (
            <VsPill
              label="Details"
              spoken="Job details"
              hint="See the whole job as we read it"
              onPress={onDetails}
            />
          ) : undefined
        }
      />
      <VsRule />
      <VsRow
        leading={
          <View
            style={[styles.thumb, { borderWidth: sizes.border, borderColor: colors.borderDefault }]}
          >
            <ResumeThumbnail style={styles.fill} />
          </View>
        }
        eyebrow="Your resume"
        title={resume.title}
        meta={resumeMetaLine(resume)}
        trailing={
          <VsPill
            label="Change"
            spoken="Change resume"
            hint="Pick a different resume to compare"
            onPress={onChange}
          />
        }
      />
    </ProfileCard>
  );
}

const useStyles = scaledSheet((s) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(ROW_GAP),
    paddingHorizontal: s(ROW_PAD_X),
    paddingVertical: s(ROW_PAD_Y),
  },
  slot: { width: s(SLOT), height: s(SLOT), alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: s(TEXT_GAP) },
  ruleRow: { paddingHorizontal: s(ROW_PAD_X) },
  rule: { height: s(RULE) },
  thumb: {
    width: s(THUMB_W),
    height: s(THUMB_H),
    borderRadius: s(THUMB_RADIUS),
    overflow: 'hidden',
  },
  fill: { flex: 1 },
  change: {
    height: s(CHANGE_H),
    paddingHorizontal: s(CHANGE_PAD_X),
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
