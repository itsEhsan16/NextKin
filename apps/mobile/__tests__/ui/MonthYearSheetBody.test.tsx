import { cleanup, fireEvent, render, screen, within } from '@testing-library/react-native';
import { View } from 'react-native';

import { MONTH_SHORT, MonthYearSheetBody } from '@/ui/MonthYearSheet';

const start = { onSelect: jest.fn(), onClose: jest.fn() };
const end = { onSelect: jest.fn(), onClose: jest.fn() };

/**
 * Both variants render in ONE tree, scoped with within(): repeated mounts have proved able to
 * wedge React's act queue in this environment (the ResumeMenuSheetBody note), and the body is
 * pure, so co-rendering the pair is free.
 *
 * The years are pinned rather than defaulted so the test does not move with the wall clock.
 */
describe('MonthYearSheetBody (Phase 9F profile dates)', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('picks a month and a year, or hands back the present sentinel', async () => {
    await render(
      <>
        <View testID="start">
          <MonthYearSheetBody
            title="Start date"
            value="2020-06-01"
            minYear={2016}
            maxYear={2026}
            {...start}
          />
        </View>
        <View testID="end">
          <MonthYearSheetBody
            title="End date"
            value="2020-06-01"
            allowPresent
            minYear={2016}
            maxYear={2026}
            {...end}
          />
        </View>
      </>,
    );

    // — Twelve months, one radio group —
    const startSheet = within(screen.getByTestId('start'));
    const grid = startSheet.getByTestId('month-grid');
    expect(grid).toHaveProp('accessibilityRole', 'radiogroup');
    expect(MONTH_SHORT).toHaveLength(12);
    expect(within(grid).getAllByRole('button')).toHaveLength(12);

    // The stored value seeds the selection, so "Done" alone is never a silent data change.
    expect(startSheet.getByLabelText('Jun')).toBeSelected();
    expect(startSheet.getByLabelText('2020')).toBeSelected();

    // — Month, then year, then commit —
    await fireEvent.press(startSheet.getByLabelText('Mar'));
    await fireEvent.press(startSheet.getByLabelText('2022'));
    expect(startSheet.getByLabelText('Mar')).toBeSelected();
    await fireEvent.press(startSheet.getByLabelText('Done'));
    expect(start.onSelect).toHaveBeenCalledTimes(1);
    expect(start.onSelect).toHaveBeenCalledWith('2022-03-01');

    await fireEvent.press(startSheet.getByLabelText('Close start date'));
    expect(start.onClose).toHaveBeenCalledTimes(1);

    // — "I currently work here" wins over whatever the grid still shows —
    const endSheet = within(screen.getByTestId('end'));
    await fireEvent.press(endSheet.getByRole('switch', { name: 'I currently work here' }));
    await fireEvent.press(endSheet.getByLabelText('Done'));
    expect(end.onSelect).toHaveBeenCalledWith('present');
    expect(end.onClose).not.toHaveBeenCalled();
  }, 30000);
});
