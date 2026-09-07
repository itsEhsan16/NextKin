import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import { INTERVIEW_GENERIC_LABEL, type Resume } from '@/data/models';
// Deep import on purpose: the resumes barrel drags its screens in. docMeta is pure formatting.
import { docSubtitle } from '@/features/resumes/docMeta';
import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { SegmentedControl, type Segment } from '@/ui/SegmentedControl';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

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

/** Grouped-row metrics, matching ListRow so this row lines up with every other carded row. */
const ROW_PADDING = 20;
const ROW_GUTTER = 16;
const CHEVRON = 11;

/**
 * What a practice set is written from (V2 §7.15): a resume — and the job it was tailored to,
 * when it has one — or a role title alone. The generic label is said here, BEFORE the set exists,
 * as well as on the set afterwards: the spec's rule is that a standalone set is never mistaken
 * for a tailored one, and the moment of choosing is the first place that could happen.
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
  const { colors, sizes, spacing, s } = useTheme();
  const styles = useStyles();

  return (
    <View style={{ gap: spacing[4] }}>
      {!libraryEmpty ? (
        <SegmentedControl segments={MODES} value={mode} onChange={onChangeMode} />
      ) : (
        <Text variant="caption" color="textSecondary">
          No resume in your library yet.
        </Text>
      )}

      {mode === 'resume' && resume ? (
        <View style={{ gap: spacing[3] }}>
          <Text variant="groupLabel">Resume</Text>
          <Card radius="card" padding={0}>
            <Pressable
              {...a11yButton(`Resume, ${resume.title}`, 'Choose a different resume')}
              feedback="subtle"
              haptic="light"
              onPress={onChooseResume}
              style={[
                styles.row,
                {
                  minHeight: sizes.listRow,
                  paddingHorizontal: s(ROW_PADDING),
                  paddingVertical: spacing[3],
                  gap: s(ROW_GUTTER),
                },
              ]}
            >
              <View style={styles.rowText}>
                <Text variant="rowTitle" numberOfLines={1}>
                  {resume.title}
                </Text>
                <Text variant="rowDescription" color="textSecondary" numberOfLines={1}>
                  {docSubtitle(resume)}
                </Text>
              </View>
              <FontAwesome5
                name="chevron-right"
                size={s(CHEVRON)}
                color={colors.iconChevron}
                solid
              />
            </Pressable>
          </Card>
          <Text variant="caption" color="textSecondary">
            {resume.linkedJobId
              ? 'Tailored to the linked job description.'
              : 'No job description linked — technical questions come from the resume alone.'}
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing[3] }}>
          <TextField
            label="Role title"
            value={roleTitle}
            onChangeText={onChangeRoleTitle}
            placeholder="Senior Data Engineer"
            autoCapitalize="words"
            returnKeyType="done"
            error={roleError}
            helper={roleError ? undefined : INTERVIEW_GENERIC_LABEL}
          />
        </View>
      )}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowText: { flex: 1, gap: s(2) },
}));
