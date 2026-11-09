import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { PeriodSwitch } from '@/features/billing/components/PeriodSwitch';
import type { Period } from '@/features/billing/components/PlanPeriodRow';

function Harness() {
  const [value, setValue] = useState<Period>('annual');
  return <PeriodSwitch value={value} onChange={setValue} yearlyBadge="−55%" />;
}

/**
 * §201: the plan switch. Its pill's glide runs on the UI thread, which the Reanimated mock does
 * not redraw, so it is checked by measuring the page in the web preview; here, the choice itself.
 */
describe('PeriodSwitch', () => {
  it('marks the picked period and moves to the other one on a tap', async () => {
    await render(<Harness />);
    expect(screen.getByRole('tab', { name: 'Yearly', selected: true })).toBeOnTheScreen();
    expect(screen.getByTestId('period-pill')).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByRole('tab', { name: 'Monthly' })));
    expect(screen.getByRole('tab', { name: 'Monthly', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Yearly', selected: false })).toBeOnTheScreen();
  });

  it('keeps each label as two cross-fading copies, ink and white', async () => {
    await render(<Harness />);
    expect(screen.getAllByText('Monthly')).toHaveLength(2);
    expect(screen.getAllByText('−55%')).toHaveLength(2);
  });
});
