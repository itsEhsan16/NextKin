import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { TextField } from '@/ui/TextField';

import type { ExperienceDraft } from '../../profileForms';
import { PROFILE_ROW_ART } from '../../profileRowArt';
import { SectionCard } from '../cards';
import { DateField, FieldError } from './DateFieldRow';
import { SkillChipsField } from './SkillChipsField';
import { ToggleFieldRow } from './ToggleFieldRow';

/** The switch that stands in for the end date; the sheet behind the end field shows the same words. */
export const STILL_HERE = 'I currently work here';

export type ExperienceDateField = 'startDate' | 'endDate';

export type ExperienceFieldsProps = {
  draft: ExperienceDraft;
  patch: (part: Partial<ExperienceDraft>) => void;
  errors: Record<string, string>;
  blur: (key: string) => void;
  onPickDate: (field: ExperienceDateField) => void;
};

/** The Start / End pair's gap at 390 (573:217). */
export const DATE_PAIR_GAP = 10 / 0.75;

/**
 * One role on the timeline the whole product generates against (V2 §7.3, PROFILE 05 573:144):
 * the Role, Dates and Skills cards.
 */
export function ExperienceFields({
  draft,
  patch,
  errors,
  blur,
  onPickDate,
}: ExperienceFieldsProps) {
  const { s } = useTheme();

  return (
    <>
      <SectionCard
        art={PROFILE_ROW_ART.experience}
        title="Role"
        subtitle="Where you worked and what you were called"
      >
        <TextField
          label="Company"
          icon="building"
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
          icon="briefcase"
          value={draft.title}
          onChangeText={(title) => patch({ title })}
          onBlur={() => blur('title')}
          placeholder="What you were called"
          error={errors.title}
          autoCapitalize="words"
          returnKeyType="next"
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
            onPress={() => onPickDate('startDate')}
            style={datePair.half}
          />
          <DateField
            label="End"
            value={draft.endDate}
            // The date is HIDDEN behind "Present" while the switch is on, never cleared. Clearing
            // it destroyed a saved value on a flick of the switch that turning it back off could
            // not undo. The end date is dropped where it belongs — at serialisation, in
            // `experienceEntry`, which omits it whenever `current` is true.
            fixedValue={draft.current ? 'Present' : undefined}
            onPress={() => onPickDate('endDate')}
            style={datePair.half}
          />
        </View>
        <ToggleFieldRow
          label={STILL_HERE}
          value={draft.current}
          onChange={(current) => patch({ current })}
        />
        <FieldError message={errors.endDate} />
      </SectionCard>

      <SkillChipsField value={draft.skills} onChange={(skills) => patch({ skills })} />
    </>
  );
}

/** Start and End side by side, shared with the education form. */
export const datePair = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  half: { flex: 1 },
});
