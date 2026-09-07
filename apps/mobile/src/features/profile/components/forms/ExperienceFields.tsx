import { View } from 'react-native';

import { useTheme } from '@/theme';
import { RowGroup } from '@/ui/ListRow';
import { TextField } from '@/ui/TextField';

import type { ExperienceDraft } from '../../profileForms';
import { DateFieldRow, FieldError } from './DateFieldRow';
import { SkillChipsField } from './SkillChipsField';
import { ToggleFieldRow } from './ToggleFieldRow';

/** The switch that hides the end date; the sheet behind the end row shows the same words. */
export const STILL_HERE = 'I currently work here';

export type ExperienceDateField = 'startDate' | 'endDate';

export type ExperienceFieldsProps = {
  draft: ExperienceDraft;
  patch: (part: Partial<ExperienceDraft>) => void;
  errors: Record<string, string>;
  blur: (key: string) => void;
  onPickDate: (field: ExperienceDateField) => void;
};

/** One role on the timeline the whole product generates against (V2 §7.3). */
export function ExperienceFields({
  draft,
  patch,
  errors,
  blur,
  onPickDate,
}: ExperienceFieldsProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing[5] }}>
      <TextField
        label="Company"
        value={draft.company}
        onChangeText={(company) => patch({ company })}
        onBlur={() => blur('company')}
        placeholder="Where you worked"
        error={errors.company}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <TextField
        label="Job title"
        value={draft.title}
        onChangeText={(title) => patch({ title })}
        onBlur={() => blur('title')}
        placeholder="What you were called"
        error={errors.title}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <View style={{ gap: spacing[2] }}>
        <RowGroup title="DATES">
          <DateFieldRow
            label="Start"
            value={draft.startDate}
            onPress={() => onPickDate('startDate')}
          />
          <ToggleFieldRow
            label={STILL_HERE}
            value={draft.current}
            // The date is HIDDEN while the switch is on, never cleared. Clearing it destroyed a
            // saved value on a flick of the switch that turning it back off could not undo: an
            // existing role's "Feb 2022" became "Not set", and saving persisted the loss. The end
            // date is already dropped where it belongs — at serialisation, in `experienceEntry`,
            // which omits it whenever `current` is true.
            onChange={(current) => patch({ current })}
          />
          {draft.current ? null : (
            <DateFieldRow label="End" value={draft.endDate} onPress={() => onPickDate('endDate')} />
          )}
        </RowGroup>
        <FieldError message={errors.endDate} />
      </View>

      <SkillChipsField value={draft.skills} onChange={(skills) => patch({ skills })} />
    </View>
  );
}
