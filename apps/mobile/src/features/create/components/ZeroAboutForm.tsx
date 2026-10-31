import { View } from 'react-native';

import { ZERO_YEARS, ZERO_YEARS_LABEL } from '@/data/models';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { FilterChip } from '@/ui/Chip';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { NAME_MAX, ROLE_MAX, type ZeroAbout, type ZeroAboutErrors } from '../zeroResume';

export type ZeroAboutFormProps = {
  about: ZeroAbout;
  /** Only the messages the reader has earned: left fields, or every field after a refusal. */
  errors: ZeroAboutErrors;
  onChange: (about: ZeroAbout) => void;
  onBlurField: (key: keyof ZeroAbout) => void;
};

// ZERO 01's inputs at 390 (613:250), in artboard units.
const CARD_PAD = 15 / 0.75;
const FIELD_GAP = 16 / 0.75;
const LABEL_TO_CHIPS = 8 / 0.75; // 613:257
const CHIP_GAP_X = 6 / 0.75; // 613:259
const CHIP_GAP_Y = 8 / 0.75;
/** The board's chips are a little tighter than the cover tone chips (613:260 vs 613:1510). */
const CHIP_PAD_X = 11 / 0.75;
const CARD_H = 264.5 / 0.75; // the loading block stands in for the whole card

/**
 * ZERO 01's three questions (613:250): the name to print, how long you have worked as one of five
 * bands, and the role you want. The bands are radios — one answer — and "None" is a real answer,
 * because this flow exists for people who have never had a job.
 */
export function ZeroAboutForm({ about, errors, onChange, onBlurField }: ZeroAboutFormProps) {
  const { s } = useTheme();
  const styles = useStyles();

  return (
    <Card radius="cardLg" style={styles.card}>
      <TextField
        label="Full name"
        icon="User01"
        value={about.fullName}
        onChangeText={(fullName) => onChange({ ...about, fullName })}
        onBlur={() => onBlurField('fullName')}
        error={errors.fullName}
        maxLength={NAME_MAX}
        autoCapitalize="words"
        autoComplete="name"
        returnKeyType="next"
      />

      <View>
        <Text variant="groupLabel" {...a11yHeader('Years of work experience')}>
          Years of work experience
        </Text>
        <View accessibilityRole="radiogroup" style={styles.chips}>
          {ZERO_YEARS.map((band) => (
            <FilterChip
              key={band}
              variant="radio"
              label={ZERO_YEARS_LABEL[band]}
              accessibilityLabel={band === 'none' ? 'None yet' : `${ZERO_YEARS_LABEL[band]} years`}
              selected={about.years === band}
              onPress={() => {
                onChange({ ...about, years: band });
                onBlurField('years');
              }}
              style={{ paddingHorizontal: s(CHIP_PAD_X) }}
            />
          ))}
        </View>
        {errors.years ? (
          <Text
            variant="caption"
            color="danger"
            accessibilityLiveRegion="polite"
            style={styles.error}
          >
            {errors.years}
          </Text>
        ) : null}
      </View>

      <TextField
        label="Role you want"
        icon="Briefcase01"
        value={about.role}
        onChangeText={(role) => onChange({ ...about, role })}
        onBlur={() => onBlurField('role')}
        error={errors.role}
        maxLength={ROLE_MAX}
        autoCapitalize="words"
        placeholder="Product Designer"
        returnKeyType="done"
      />
    </Card>
  );
}

/** The card's loading shape, so the page does not jump when the name prefill lands. */
export function ZeroAboutFormSkeleton() {
  const { s } = useTheme();
  return <Skeleton height={s(CARD_H)} radius="cardLg" />;
}

const useStyles = scaledSheet((s) => ({
  card: { padding: s(CARD_PAD), gap: s(FIELD_GAP) },
  chips: {
    marginTop: s(LABEL_TO_CHIPS),
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: s(CHIP_GAP_X),
    rowGap: s(CHIP_GAP_Y),
  },
  error: { marginTop: s(LABEL_TO_CHIPS) },
}));
