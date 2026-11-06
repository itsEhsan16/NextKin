import { View } from 'react-native';

import { formatZeroDate, zeroDateIso, type ZeroDate } from '@/data/models';
import { scaledSheet, useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
import { Button } from '@/ui/Button';
import { MonthYearSheetBody } from '@/ui/MonthYearSheet';
import { OptionSheetHeader } from '@/ui/OptionSheet';
import { SelectField } from '@/ui/SelectField';
import { Text } from '@/ui/Text';

// ZERO 04's sheet at 390 (613:572), in artboard units.
const DATE_GAP = 10 / 0.75; // 613:600
const FIELDS_TO_SAVE = 20 / 0.75; // 613:615
const SAVE_TO_DELETE = 10 / 0.75; // 613:618
const BUTTON_H = 48 / 0.75;
const BUTTON_RADIUS = 13.5 / 0.75;

export type ZeroEnd = ZeroDate | 'present';

/** Which date the sheet is asking for, while the month picker stands in for the form. */
export type DatePane = 'from' | 'to' | null;

const ISO = /^(\d{4})-(\d{2})/;

export const dateOfIso = (iso: string): ZeroDate | null => {
  const match = ISO.exec(iso);
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
};

const order = (date: ZeroDate): number => date.year * 12 + (date.month ?? 1);

/** "The end can't be before the start" — the one rule about a pair of dates. */
export const datesError = (start: ZeroDate, end: ZeroEnd): string | undefined =>
  end !== 'present' && order(end) < order(start) ? 'The end can’t be before the start.' : undefined;

/**
 * The question above a check form: in the sheet, "1 of 9 · Roles and dates" and the ✕; inline on
 * the review screen (§173, no `onClose`), a warning line "Our guess — check it" and the question.
 */
export function CheckHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle: string;
  onClose?: () => void;
}) {
  const { colors, u } = useTheme();
  if (onClose) {
    return <OptionSheetHeader variant="card" title={title} subtitle={subtitle} onClose={onClose} />;
  }
  return (
    <View style={{ gap: u(6) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(6) }}>
        <Icon name="AlertCircle" size={u(16)} color={colors.warningStrong} />
        <Text variant="footnote" color="warningStrong">
          Our guess — check it
        </Text>
      </View>
      <Text variant="title1" color="ink" accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

/** From and To side by side (613:600); a year-only guess reads as the year alone, "2021". */
export function DateRow({
  start,
  end,
  presentLabel,
  error,
  onPick,
}: {
  start: ZeroDate;
  end: ZeroEnd;
  presentLabel: string;
  error?: string;
  onPick: (pane: 'from' | 'to') => void;
}) {
  const styles = useStyles();
  return (
    <View>
      <View style={styles.dates}>
        <SelectField
          label="From"
          icon="Calendar"
          value={formatZeroDate(start)}
          hint="Opens the month picker"
          onPress={() => onPick('from')}
          style={styles.date}
        />
        <SelectField
          label="To"
          icon="Calendar"
          value={end === 'present' ? presentLabel : formatZeroDate(end)}
          hint="Opens the month picker"
          onPress={() => onPick('to')}
          style={styles.date}
        />
      </View>
      {error ? (
        <Text
          variant="caption"
          color="danger"
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** The month picker in the sheet's place, until a date is picked or it is closed. */
export function DatePicker({
  pane,
  start,
  end,
  stillLabel,
  onPick,
  onClose,
}: {
  pane: 'from' | 'to';
  start: ZeroDate;
  end: ZeroEnd;
  /** The "still here" switch on To: "I still work here", "I'm still studying". */
  stillLabel: string;
  onPick: (pane: 'from' | 'to', value: ZeroEnd) => void;
  onClose: () => void;
}) {
  const value =
    pane === 'from' ? zeroDateIso(start) : end === 'present' ? 'present' : zeroDateIso(end);
  return (
    <MonthYearSheetBody
      title={pane === 'from' ? 'From' : 'To'}
      value={value}
      allowPresent={pane === 'to'}
      presentLabel={stillLabel}
      onSelect={(picked) => {
        if (picked === 'present') return onPick(pane, 'present');
        const date = dateOfIso(picked);
        if (date) onPick(pane, date);
      }}
      onClose={onClose}
    />
  );
}

/** Save and next over Delete (613:616 / 613:619). Delete waits while a save is in flight. */
export function CheckButtons({
  deleteLabel,
  busy,
  onSave,
  onDelete,
}: {
  deleteLabel: string;
  busy: boolean;
  onSave: () => void;
  onDelete: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.buttons}>
      <Button
        label="Save and next"
        block
        haptic="medium"
        loading={busy}
        onPress={onSave}
        style={styles.button}
      />
      <Button
        label={deleteLabel}
        variant="dangerOutline"
        block
        disabled={busy}
        onPress={onDelete}
        style={[styles.button, styles.delete]}
      />
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  dates: { flexDirection: 'row', gap: s(DATE_GAP) },
  date: { flex: 1 },
  error: { marginTop: s(DATE_GAP) },
  buttons: { marginTop: s(FIELDS_TO_SAVE) },
  button: { height: s(BUTTON_H), borderRadius: s(BUTTON_RADIUS) },
  delete: { marginTop: s(SAVE_TO_DELETE) },
}));
