import { View } from 'react-native';

import { INTERVIEW_GENERIC_LABEL, type Resume } from '@/data/models';
// Deep imports on purpose: the resumes barrel drags its screens in. These are pure pieces.
import { AtsBadge } from '@/features/resumes/components/AtsBadge';
import { ResumeThumbnail } from '@/features/resumes/components/ResumeThumbnail';
import { docSubtitle } from '@/features/resumes/docMeta';
import { a11yButton, a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { NoteBar } from '@/ui/NoteBar';
import { Pressable } from '@/ui/Pressable';
import { SegmentedControl, type Segment } from '@/ui/SegmentedControl';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { Icon } from '@/ui/Icon';

export type InterviewSourceMode = 'resume' | 'role';

const MODES: readonly Segment<InterviewSourceMode>[] = [
  { key: 'resume', label: 'From a resume' },
  { key: 'role', label: 'By role title' },
];

export type InterviewSourcePickerProps = {
  mode: InterviewSourceMode;
  onChangeMode: (mode: InterviewSourceMode) => void;
  /** The chosen library document; absent when the library is empty. */
  resume?: Resume;
  /** Opens the library sheet — mounted by the screen beside its `<Screen>`, never in here. */
  onChooseResume: () => void;
  roleTitle: string;
  onChangeRoleTitle: (value: string) => void;
  roleError?: string;
  /** True when the resume segment is unavailable: an empty library pins the picker to role mode. */
  libraryEmpty: boolean;
};

// INTERVIEW 02 at 390 (577:1893 control, 577:1898 step card), in artboard units.
const CONTROL_TO_CARD = 14;
const CARD_PAD = 15;
const CARD_GAP = 12;
const STEP_GAP = 10;
const STEP_DISC = 24;
const ROW_RADIUS = 14;
const ROW_PAD_LEFT = 10;
const ROW_PAD_RIGHT = 12;
const ROW_PAD_Y = 10;
const ROW_GAP = 12;
const THUMB = 46;
const THUMB_RADIUS = 8;
const LINE_GAP = 2;

/**
 * What a practice set is written from (V2 §7.15, INTERVIEW 02 577:1861): a resume — and the job it
 * was tailored to, when it has one — or a role title alone, as step 1 of one card. The generic
 * label is said here, BEFORE the set exists, as well as on the set afterwards: the spec's rule is
 * that a standalone set is never mistaken for a tailored one, and the moment of choosing is the
 * first place that could happen.
 */
export function InterviewSourcePicker({
  mode,
  onChangeMode,
  resume,
  onChooseResume,
  roleTitle,
  onChangeRoleTitle,
  roleError,
  libraryEmpty,
}: InterviewSourcePickerProps) {
  const { colors, s } = useTheme();
  const styles = useStyles();
  const fromResume = mode === 'resume' && resume != null;

  const step = (title: string) => (
    <View style={styles.step}>
      <View style={[styles.disc, { backgroundColor: colors.surfaceInverse }]}>
        <Text variant="microBadge" color="textOnDark">
          1
        </Text>
      </View>
      <Text variant="title" style={styles.grow} {...a11yHeader(title)}>
        {title}
      </Text>
    </View>
  );

  return (
    <View>
      {!libraryEmpty ? (
        <SegmentedControl segments={MODES} value={mode} onChange={onChangeMode} />
      ) : (
        <Text variant="caption" color="textSecondary" align="center">
          No resume in your library yet.
        </Text>
      )}

      <Card radius="cardLg" shadow="jobCard" padding={s(CARD_PAD / 0.75)} style={styles.card}>
        {fromResume ? (
          <>
            {step('Choose a resume')}
            <Pressable
              {...a11yButton(`Resume, ${resume.title}`, 'Choose a different resume')}
              feedback="subtle"
              haptic="light"
              onPress={onChooseResume}
              style={[styles.row, { backgroundColor: colors.surfaceSubtle }]}
            >
              <View style={[styles.thumb, { backgroundColor: colors.surfaceCard }]}>
                <ResumeThumbnail style={styles.fill} />
              </View>
              <View style={styles.text}>
                <Text variant="label" numberOfLines={1}>
                  {resume.title}
                </Text>
                <Text variant="micro" color="textSecondary" numberOfLines={2}>
                  {docSubtitle(resume)}
                </Text>
              </View>
              {resume.atsScore != null ? <AtsBadge score={resume.atsScore} size="sm" /> : null}
              <Icon name="ChevronRight" size="sm" color={colors.iconChevron} />
            </Pressable>
            <NoteBar
              text={
                resume.linkedJobId
                  ? 'Tailored to the linked job description.'
                  : 'No job description linked — technical questions come from the resume alone.'
              }
            />
          </>
        ) : (
          <>
            {step('Name the role')}
            <TextField
              value={roleTitle}
              onChangeText={onChangeRoleTitle}
              accessibilityLabel="Role title"
              placeholder="Senior Data Engineer"
              autoCapitalize="words"
              returnKeyType="done"
              error={roleError}
            />
            <NoteBar icon="InfoCircle" text={INTERVIEW_GENERIC_LABEL} />
          </>
        )}
      </Card>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  card: { marginTop: s(CONTROL_TO_CARD / 0.75), gap: s(CARD_GAP / 0.75) },
  step: { flexDirection: 'row', alignItems: 'center', gap: s(STEP_GAP / 0.75) },
  disc: {
    width: s(STEP_DISC / 0.75),
    height: s(STEP_DISC / 0.75),
    borderRadius: s(STEP_DISC / 0.75) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(ROW_GAP / 0.75),
    borderRadius: s(ROW_RADIUS / 0.75),
    paddingLeft: s(ROW_PAD_LEFT / 0.75),
    paddingRight: s(ROW_PAD_RIGHT / 0.75),
    paddingVertical: s(ROW_PAD_Y / 0.75),
  },
  thumb: {
    width: s(THUMB / 0.75),
    height: s(THUMB / 0.75),
    borderRadius: s(THUMB_RADIUS / 0.75),
    overflow: 'hidden',
  },
  fill: { flex: 1 },
  text: { flex: 1, gap: s(LINE_GAP / 0.75) },
}));
