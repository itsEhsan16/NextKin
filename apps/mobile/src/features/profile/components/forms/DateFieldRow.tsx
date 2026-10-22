import type { StyleProp, ViewStyle } from 'react-native';

import { formatMonthYear } from '@/lib';
import { SelectField } from '@/ui/SelectField';
import { Text } from '@/ui/Text';

/** Nothing has been picked yet. Said plainly rather than guessed at (V2 §7.9). */
export const NO_DATE = 'Not set';

export type DateFieldProps = {
  label: string;
  /** ISO 'YYYY-MM-01', or '' while nothing has been picked. */
  value: string;
  /** Replaces the empty value on a field that is standing in for something else ("Doesn't expire"). */
  emptyValue?: string;
  /** Shown instead of the date, inert — the end of a role still held reads "Present". */
  fixedValue?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * A month/year field (PROFILE 05 573:222): the filled field box with a calendar, the month and a
 * chevron. The profile stores a month, and the picker behind it is `MonthYearSheet`, which the
 * screen raises as a sibling of the page — inside the field it would scrim the scroller.
 *
 * An empty value is grey, the way a placeholder is, unless it stands for something real
 * ("Doesn't expire" is an answer, not a blank).
 */
export function DateField({
  label,
  value,
  emptyValue = NO_DATE,
  fixedValue,
  onPress,
  style,
}: DateFieldProps) {
  const picked = value.length > 0 ? formatMonthYear(value) : undefined;
  const answered = emptyValue !== NO_DATE;
  return (
    <SelectField
      label={label}
      icon="calendar-alt"
      value={fixedValue ?? picked ?? (answered ? emptyValue : undefined)}
      placeholder={NO_DATE}
      hint="Opens the month picker"
      disabled={fixedValue != null}
      onPress={onPress}
      style={style}
    />
  );
}

/**
 * A rule about a group of fields rather than about one — "the end date is before the start date".
 * `TextField` draws its own error; a pair of date fields has nowhere to put one, so it goes here.
 */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}
