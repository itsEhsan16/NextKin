import { formatMonthYear } from '@/lib';
import { ListRow } from '@/ui/ListRow';
import { Text } from '@/ui/Text';

/** Nothing has been picked yet. Said plainly rather than guessed at (V2 §7.9). */
export const NO_DATE = 'Not set';

export type DateFieldRowProps = {
  label: string;
  /** ISO 'YYYY-MM-01', or '' while nothing has been picked. */
  value: string;
  /** Replaces the empty value on a field that is standing in for something else ("Present"). */
  emptyValue?: string;
  onPress: () => void;
};

/**
 * A month/year field, drawn as a grouped settings row rather than a text input: the profile
 * stores a month, and the picker behind it is `MonthYearSheet`. The sheet itself is raised by
 * the screen, as a sibling of the page — inside this row it would scrim the scroller.
 */
export function DateFieldRow({ label, value, emptyValue = NO_DATE, onPress }: DateFieldRowProps) {
  const shown = value.length > 0 ? formatMonthYear(value) : emptyValue;
  return (
    <ListRow
      icon="calendar-alt"
      label={label}
      value={shown}
      accessibilityLabel={`${label}, ${shown}`}
      accessibilityHint="Opens the month picker"
      onPress={onPress}
    />
  );
}

/**
 * A rule about a group of rows rather than about one field — "the end date is before the start
 * date". `TextField` draws its own error; a `RowGroup` has nowhere to put one, so it goes here.
 */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}
