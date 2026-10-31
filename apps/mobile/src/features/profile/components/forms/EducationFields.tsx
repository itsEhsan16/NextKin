import { View } from 'react-native';

import { useTheme } from '@/theme';
import { TextField, useFieldChain } from '@/ui/TextField';

import type { EducationDraft } from '../../profileForms';
import { PROFILE_ROW_ART } from '../../profileRowArt';
import { SectionCard } from '../cards';
import { DateField, FieldError } from './DateFieldRow';
import { DATE_PAIR_GAP, datePair } from './ExperienceFields';
import { ToggleFieldRow } from './ToggleFieldRow';

/** The switch that stands in for the end date. */
export const STILL_STUDYING = "I'm still studying here";

export type EducationDateField = 'startDate' | 'endDate';

export type EducationFieldsProps = {
  draft: EducationDraft;
  patch: (part: Partial<EducationDraft>) => void;
  errors: Record<string, string>;
  blur: (key: string) => void;
  onPickDate: (field: EducationDateField) => void;
  /** The date whose picker is up, if one is. */
  picking?: EducationDateField | null;
};

/** One qualification on the profile (V2 §7.3, PROFILE 08 577:7432): Education and Dates cards. */
export function EducationFields({
  draft,
  patch,
  errors,
  blur,
  onPickDate,
  picking,
}: EducationFieldsProps) {
  const { s } = useTheme();
  const link = useFieldChain(3);

  return (
    <>
      <SectionCard art={PROFILE_ROW_ART.education} title="Education">
        <TextField
          {...link(0)}
          label="School or university"
          icon="Building01"
          value={draft.institution}
          onChangeText={(institution) => patch({ institution })}
          onBlur={() => blur('institution')}
          placeholder="Where you studied"
          error={errors.institution}
          autoCapitalize="words"
        />
        <TextField
          {...link(1)}
          label="Qualification"
          icon="GraduationHat01"
          value={draft.degree}
          onChangeText={(degree) => patch({ degree })}
          onBlur={() => blur('degree')}
          placeholder="B.E., M.Des., a course name"
          error={errors.degree}
        />
        <TextField
          {...link(2)}
          label="Field of study"
          optional
          icon="BookOpen01"
          value={draft.field}
          onChangeText={(field) => patch({ field })}
          onBlur={() => blur('field')}
          placeholder="What you studied"
          autoCapitalize="words"
        />
      </SectionCard>

      <SectionCard
        art={PROFILE_ROW_ART.availability}
        artWidth={26}
        title="Dates"
        subtitle="Month and year are enough"
      >
        <View style={[datePair.row, { gap: s(DATE_PAIR_GAP) }]}>
          <DateField
            label="Start"
            value={draft.startDate}
            open={picking === 'startDate'}
            onPress={() => onPickDate('startDate')}
            style={datePair.half}
          />
          <DateField
            label="End"
            value={draft.endDate}
            // Hidden behind "Present", not cleared — see the same field on ExperienceFields.
            fixedValue={draft.current ? 'Present' : undefined}
            open={picking === 'endDate'}
            onPress={() => onPickDate('endDate')}
            style={datePair.half}
          />
        </View>
        <ToggleFieldRow
          label={STILL_STUDYING}
          value={draft.current}
          onChange={(current) => patch({ current })}
        />
        <FieldError message={errors.endDate} />
      </SectionCard>
    </>
  );
}
