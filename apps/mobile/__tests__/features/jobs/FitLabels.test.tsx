import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';

import { FitLabels } from '@/features/jobs';
import { ClashPill } from '@/features/jobs/components/JobPills';
import { HiddenPicksNote } from '@/features/home/components/HiddenPicksNote';

describe('fit labels (toreview §147.3)', () => {
  afterEach(() => cleanup());

  it('lists what the job states against what was asked for', async () => {
    await render(
      <FitLabels
        labels={[
          { kind: 'workplace', state: 'fits', text: 'Remote works for you' },
          { kind: 'salary', state: 'clashes', text: 'Below your minimum salary' },
          { kind: 'location', state: 'unknown', text: 'Location not stated' },
        ]}
      />,
    );
    expect(screen.getByText('Against your preferences')).toBeOnTheScreen();
    expect(screen.getByText('Below your minimum salary')).toBeOnTheScreen();
    expect(screen.getByText('Location not stated')).toBeOnTheScreen();
  });

  it('draws nothing with nothing asked for', async () => {
    await render(<FitLabels labels={[]} />);
    expect(screen.queryByText('Against your preferences')).toBeNull();
  });

  it('names a clash on a card that stays in the list', async () => {
    await render(<ClashPill label="Hybrid, and you prefer remote" />);
    expect(screen.getByText('Hybrid, and you prefer remote')).toBeOnTheScreen();
  });

  it('says what the picks left out, and opens all jobs', async () => {
    const open = jest.fn();
    await render(
      <HiddenPicksNote
        hidden={{ count: 2, reasons: ['Below your minimum salary'] }}
        onPress={open}
      />,
    );
    await fireEvent.press(screen.getByLabelText('2 hidden: Below your minimum salary'));
    expect(open).toHaveBeenCalled();
  });
});
