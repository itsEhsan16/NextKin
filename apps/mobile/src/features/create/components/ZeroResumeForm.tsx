import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import {
  LOCATION_MAX,
  NAME_MAX,
  TITLE_MAX,
  ZERO_RESUME_GUARDRAIL_BODY,
  ZERO_RESUME_GUARDRAIL_TITLE,
  type ZeroResumeDraft,
} from '../zeroResume';

export type ZeroResumeFormProps = {
  draft: ZeroResumeDraft;
  /** Only the messages the reader has earned: blurred fields, or every field after a refusal. */
  errors: Record<string, string>;
  onChange: (draft: ZeroResumeDraft) => void;
  onBlurField: (key: keyof ZeroResumeDraft) => void;
};

/** Warning-card chrome: the leading glyph and the width the copy wraps against. */
const GUARDRAIL_ICON = 18;
/** Three digits is more years than anyone has worked; the cap is on the keyboard, not a rule. */
const YEARS_MAX_LENGTH = 3;

/**
 * The §7.9 integrity note. It is the point of this screen rather than decoration on it: a resume
 * generated from four fields must never read as a claim about someone's history, so the page says
 * what will be missing from the draft before the reader types anything into it.
 *
 * Warning tone, from the tokens the usage meters and match pills already use — loud enough to be
 * read, not an error the reader has to clear.
 */
export function ZeroResumeGuardrail() {
  const { colors, spacing, s } = useTheme();

  return (
    <Card
      radius="card"
      elevated={false}
      style={{ backgroundColor: colors.warningSurface, borderColor: colors.warning }}
    >
      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        <FontAwesome5
          name="exclamation-triangle"
          size={s(GUARDRAIL_ICON)}
          color={colors.warning}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          solid
        />
        <View style={{ flex: 1, gap: spacing[2] }}>
          <Text variant="title" color="warningStrong" accessibilityRole="header">
            {ZERO_RESUME_GUARDRAIL_TITLE}
          </Text>
          <Text variant="prose" color="textBody">
            {ZERO_RESUME_GUARDRAIL_BODY}
          </Text>
        </View>
      </View>
    </Card>
  );
}

/**
 * The four things §7.9 starts from: a name, a count of years, and — optional, because the spec
 * marks them so — a target title and a place.
 *
 * Zero is a real answer to the years question and the field says so out loud: this feature is for
 * the person who has never had a job, and a helper that assumes otherwise is the first thing that
 * would send them away.
 */
export function ZeroResumeForm({ draft, errors, onChange, onBlurField }: ZeroResumeFormProps) {
  const { spacing } = useTheme();
  const set = (patch: Partial<ZeroResumeDraft>) => onChange({ ...draft, ...patch });

  return (
    <View style={{ gap: spacing[4] }}>
      <TextField
        label="Full name"
        value={draft.fullName}
        onChangeText={(fullName) => set({ fullName })}
        onBlur={() => onBlurField('fullName')}
        placeholder="The name to print at the top"
        helper="This is the only name on the draft. Change it if you go by another one."
        autoCapitalize="words"
        autoComplete="name"
        maxLength={NAME_MAX}
        returnKeyType="next"
        {...(errors.fullName ? { error: errors.fullName } : {})}
      />

      <TextField
        label="Years of experience"
        value={draft.yearsExperience}
        onChangeText={(yearsExperience) => set({ yearsExperience })}
        onBlur={() => onBlurField('yearsExperience')}
        placeholder="0"
        helper="Whole years. Type 0 if you have not worked yet — that is what this mode is for."
        keyboardType="number-pad"
        maxLength={YEARS_MAX_LENGTH}
        {...(errors.yearsExperience ? { error: errors.yearsExperience } : {})}
      />

      <TextField
        label="Target job title"
        value={draft.targetTitle}
        onChangeText={(targetTitle) => set({ targetTitle })}
        onBlur={() => onBlurField('targetTitle')}
        placeholder="Product Designer"
        helper="Optional. It names the draft and steers what the summary aims at."
        autoCapitalize="words"
        maxLength={TITLE_MAX}
        {...(errors.targetTitle ? { error: errors.targetTitle } : {})}
      />

      <TextField
        label="Location"
        value={draft.location}
        onChangeText={(location) => set({ location })}
        onBlur={() => onBlurField('location')}
        placeholder="City, country"
        helper="Optional. Left out of the draft entirely if you leave it blank."
        icon="map-marker-alt"
        autoCapitalize="words"
        maxLength={LOCATION_MAX}
        {...(errors.location ? { error: errors.location } : {})}
      />
    </View>
  );
}

/**
 * Block geometry, each the composed height of what replaces it — Card is 16pt of padding and a
 * 1pt hairline on both sides, so every card block carries that 34pt:
 *
 * - `BANNER`    34 + caption 20 + gap 12 + 4pt bar
 * - `GUARDRAIL` 34 + title 24 + gap 8 + five prose lines at 25
 * - `LABEL`     the field label line
 * - `FIELD`     the 52pt box plus its 8pt gap and 19pt helper line
 * - `CHOICES`   34 + three 52pt SheetRows + two 16pt gaps
 */
const BANNER = 70;
const GUARDRAIL = 191;
const LABEL = 20;
const FIELD = 79;
const CHOICES = 222;
const FIELDS = [0, 1, 2, 3];

/**
 * The intake's loading state. Blocks in the shape of the content that replaces them, so nothing
 * jumps when the plan and the user land — never a spinner. The screen pins an inert
 * `StickyActionBar` under it for the same reason: the bar owns the bottom inset, so a loading page
 * without one would resize the viewport the moment the queries settle.
 */
export function ZeroResumeSkeleton() {
  const { spacing, s } = useTheme();

  return (
    <View accessible accessibilityLabel="Loading first draft setup" style={{ gap: spacing[6] }}>
      <Skeleton height={s(BANNER)} radius="card" />
      <Skeleton height={s(GUARDRAIL)} radius="card" />
      <View style={{ gap: spacing[4] }}>
        {FIELDS.map((field) => (
          <View key={field} style={{ gap: spacing[2] }}>
            <Skeleton width="40%" height={s(LABEL)} />
            <Skeleton height={s(FIELD)} radius="xl" />
          </View>
        ))}
      </View>
      <View style={{ gap: spacing[3] }}>
        <Skeleton width="45%" height={s(LABEL)} />
        <Skeleton height={s(CHOICES)} radius="card" />
      </View>
    </View>
  );
}
