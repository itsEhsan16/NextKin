/**
 * Month/year picker sheet for the Phase 9F profile date fields (experience, education,
 * certifications). Thin wrapper over MonthYearSheetBody, exactly like OptionSheet.
 */
import { useTheme } from '@/theme';
import { Sheet } from '@/ui/Sheet';

import { MonthYearSheetBody, type MonthYearSheetBodyProps } from './MonthYearSheetBody';

export type MonthYearSheetProps = MonthYearSheetBodyProps & {
  open: boolean;
};

export function MonthYearSheet({ open, ...body }: MonthYearSheetProps) {
  const { sizes } = useTheme();
  return (
    <Sheet
      open={open}
      onClose={body.onClose}
      height={sizes.sheetMonthYearHeight}
      accessibilityLabel={body.title}
    >
      <MonthYearSheetBody {...body} />
    </Sheet>
  );
}
