/**
 * The two sheet demos on the dev forms gallery (plan §Phase 9A), lifted out of `app/dev/forms.tsx`
 * so that page stays a readable length.
 *
 * Split in three parts because a `Sheet` is an `absoluteFill` overlay with no Modal behind it: it
 * measures against its nearest parent, so mounted inside a `DevSection` it would size its scrim and
 * its surface to a 150pt block of scrolling page. `useFormsSheetDemos` holds the state the two
 * halves share, `FormsSheetSections` is the prose and the triggers that belong in the page, and
 * `FormsSheets` is the pair of overlays the route mounts as a sibling of `<Screen>` — outside both
 * the scroller and the keyboard-avoiding view, the way `NotificationsScreen` mounts its row menu.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { formatMonthYear } from '@/lib';
import { useTheme } from '@/theme';
import { MonthYearSheet, type MonthYearValue } from '@/ui/MonthYearSheet';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { DevButton, DevSection } from '@/ui/dev';

/** What the field would show once a date has been picked. */
function dateLabel(value: MonthYearValue | undefined): string {
  if (value === 'present') return 'Present';
  return value ? formatMonthYear(value) : 'Pick a month';
}

/** The open flags and picked values both halves of the demo read. Owned by the route. */
export function useFormsSheetDemos() {
  const [dateOpen, setDateOpen] = useState(false);
  const [date, setDate] = useState<MonthYearValue | undefined>(undefined);
  const [renameOpen, setRenameOpen] = useState(false);
  const [resumeName, setResumeName] = useState('Backend engineer');

  return {
    date,
    dateOpen,
    renameOpen,
    resumeName,
    setDate,
    setDateOpen,
    setRenameOpen,
    setResumeName,
  };
}

export type FormsSheetDemoState = ReturnType<typeof useFormsSheetDemos>;

/** The prose and the two buttons that open the sheets. Lives inside the page's scroller. */
export function FormsSheetSections({ date, setDateOpen, setRenameOpen }: FormsSheetDemoState) {
  return (
    <>
      <DevSection
        title="Month/year sheet"
        description="A year strip and twelve month chips rather than a calendar: no profile date the app stores has a day in it, and every real date picker is a native module Expo Go cannot load. `allowPresent` adds the switch below the title, and the sheet then resolves to the 'present' sentinel instead of a date. The strip opens on the selected year, once, so a later layout pass cannot yank it back under a finger."
      >
        <DevButton label={dateLabel(date)} onPress={() => setDateOpen(true)} grow />
      </DevSection>

      <DevSection
        title="Keyboard-aware sheet"
        description="`avoidKeyboard` lifts the sheet clear of the iOS keyboard; Android already resizes the window, so it does nothing there. One field per sheet is the rule — the lift moves the whole surface, so a second field would still be pushed off the top. Anything longer belongs on a pushed <Screen keyboard>, which scrolls."
      >
        <DevButton label="Rename resume" onPress={() => setRenameOpen(true)} grow />
      </DevSection>
    </>
  );
}

/** The overlays themselves. Mounted beside the page, never inside it — see the file note. */
export function FormsSheets({
  date,
  dateOpen,
  renameOpen,
  resumeName,
  setDate,
  setDateOpen,
  setRenameOpen,
  setResumeName,
}: FormsSheetDemoState) {
  const { sizes, spacing } = useTheme();

  return (
    <>
      <MonthYearSheet
        open={dateOpen}
        title="End date"
        value={date}
        allowPresent
        onSelect={(value) => {
          setDate(value);
          setDateOpen(false);
        }}
        onClose={() => setDateOpen(false)}
      />

      <Sheet
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        height={sizes.sheetPickerHeight}
        avoidKeyboard
        accessibilityLabel="Rename resume"
      >
        {/* Sheet hands its children no gutter — every body pads its own, as MonthYearSheetBody
            does — so the padding is stated here. */}
        <View
          style={{
            paddingHorizontal: spacing.gutter,
            paddingTop: spacing[4],
            paddingBottom: spacing[6],
            gap: spacing[4],
          }}
        >
          <Text variant="headline">Rename resume</Text>
          <TextField
            label="Resume name"
            value={resumeName}
            onChangeText={setResumeName}
            placeholder="Backend engineer"
            autoFocus
            maxLength={60}
            showCount
            returnKeyType="done"
            onSubmit={() => setRenameOpen(false)}
          />
        </View>
      </Sheet>
    </>
  );
}
