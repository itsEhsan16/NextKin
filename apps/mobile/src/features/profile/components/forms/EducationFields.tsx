import { View } from 'react-native';

import { useTheme } from '@/theme';
import { RowGroup } from '@/ui/ListRow';
import { TextField } from '@/ui/TextField';

import type { EducationDraft } from '../../profileForms';
import { DateFieldRow, FieldError } from './DateFieldRow';
import { ToggleFieldRow } from './ToggleFieldRow';

/** The switch that hides the end date. */
export const STILL_STUDYING = "I'm still studying here";

export type EducationDateField = 'startDate' | 'endDate';

export type EducationFieldsProps = {
  draft: EducationDraft;
  patch: (part: Partial<EducationDraft>) => void;
  errors: Record<string, string>;
  blur: (key: string) => void;
  onPickDate: (field: EducationDateField) => void;
};

/** One qualification on the profile (V2 §7.3). */
export function EducationFields({ draft, patch, errors, blur, onPickDate }: EducationFieldsProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing[5] }}>
      <TextField
        label="School or university"
        value={draft.institution}
        onChangeText={(institution) => patch({ institution })}
        onBlur={() => blur('institution')}
        placeholder="Where you studied"
        error={errors.institution}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <TextField
        label="Qualification"
        value={draft.degree}
        onChangeText={(degree) => patch({ degree })}
        onBlur={() => blur('degree')}
        placeholder="B.E., M.Des., a course name"
        error={errors.degree}
        returnKeyType="next"
      />

      <TextField
        label="Field of study"
        value={draft.field}
        onChangeText={(field) => patch({ field })}
        onBlur={() => blur('field')}
        placeholder="Optional"
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
            label={STILL_STUDYING}
            value={draft.current}
            // Hidden, not cleared — see the same row on ExperienceFields. `educationEntry` omits
            // the end date when `current` is true, so clearing it here only destroyed the value.
            onChange={(current) => patch({ current })}
          />
          {draft.current ? null : (
            <DateFieldRow label="End" value={draft.endDate} onPress={() => onPickDate('endDate')} />
          )}
        </RowGroup>
        <FieldError message={errors.endDate} />
      </View>
    </View>
  );
}
