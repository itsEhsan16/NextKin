import type { JSX } from 'react';
import { View } from 'react-native';

import { ZERO_CHECK_GROUP_LABEL, type ZeroCheckItem, type ZeroResolution } from '@/data/models';
import { useTheme } from '@/theme';
import { Sheet } from '@/ui/Sheet';

import { EducationCheckForm, RoleCheckForm, SkillCheckForm } from './ZeroCheckForms';

export type ZeroCheckSheetProps = {
  open: boolean;
  /** The guess to answer; the sheet closes itself when none are left. */
  item: ZeroCheckItem | undefined;
  /** Which of the draft's checks this is, and of how many: "1 of 9". */
  at: number;
  total: number;
  busy: boolean;
  error?: string;
  onResolve: (resolution: ZeroResolution) => void;
  onClose: () => void;
};

// ZERO 04's sheet at 390 (613:572), in artboard units.
const TOP = 16 / 0.75; // handle → header: the board's 30 less the handle and its margin
const BOTTOM = 30 / 0.75;
const SHEET_FLOOR = 519 / 0.75;

const itemKey = (item: ZeroCheckItem): string =>
  item.kind === 'role'
    ? `role:${item.role.id}`
    : item.kind === 'skill'
      ? `skill:${item.skill}`
      : `edu:${item.entry.id}`;

/**
 * ZERO 04's content, separate from the Sheet so tests can drive it without gestures (the
 * OptionSheetBody split). Each guess gets a fresh form — keyed by what it asks about — so the
 * next question never opens holding the last one's typing.
 */
export function ZeroCheckSheetBody({
  item,
  at,
  total,
  ...props
}: Omit<ZeroCheckSheetProps, 'open'>) {
  const { spacing, s } = useTheme();
  if (!item) return null;
  const subtitle = `${at} of ${total} · ${ZERO_CHECK_GROUP_LABEL[item.kind]}`;
  const form = { subtitle, ...props };

  return (
    <View
      style={{ paddingHorizontal: spacing.gutter, paddingTop: s(TOP), paddingBottom: s(BOTTOM) }}
    >
      {item.kind === 'role' ? (
        <RoleCheckForm key={itemKey(item)} role={item.role} {...form} />
      ) : item.kind === 'skill' ? (
        <SkillCheckForm key={itemKey(item)} skill={item.skill} {...form} />
      ) : (
        <EducationCheckForm key={itemKey(item)} entry={item.entry} {...form} />
      )}
    </View>
  );
}

/** "Is this role right?" and the questions after it, one guess at a time (ZERO 04). */
export function ZeroCheckSheet({ open, ...body }: ZeroCheckSheetProps): JSX.Element {
  const { s } = useTheme();
  return (
    <Sheet
      open={open && body.item != null}
      onClose={body.onClose}
      height={s(SHEET_FLOOR)}
      avoidKeyboard
      // The form has text fields and a month picker; a dismiss pan would fight their gestures.
      // The ✕, the scrim and Android back all still close it.
      swipeToDismiss={false}
      accessibilityLabel="Check a guess"
    >
      <ZeroCheckSheetBody {...body} />
    </Sheet>
  );
}
