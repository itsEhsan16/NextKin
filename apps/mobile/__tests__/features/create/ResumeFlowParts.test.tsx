import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { ProgressButton, READ_STAGES } from '@/features/create/flow/ProgressButton';
import { BuildNextTiles } from '@/features/generations/components/BuildReadyParts';
import { TailorReady } from '@/features/generations/components/TailorReady';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const wrap = (node: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={metrics}>{node}</SafeAreaProvider>);

describe('the resume flow’s web-matching parts (toreview §235)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
  });

  it('walks the job step’s Continue through the web’s reading stages', async () => {
    const view = await wrap(<ProgressButton label="Continue" working={false} onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeOnTheScreen();

    await view.rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <ProgressButton label="Continue" working onPress={() => {}} />
      </SafeAreaProvider>,
    );
    expect(screen.getByLabelText(READ_STAGES[0])).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(1600));
    expect(screen.getByLabelText(READ_STAGES[1])).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(3600));
    expect(screen.getByLabelText(READ_STAGES[2])).toBeOnTheScreen();
  });

  it('ends the ready screen with the cover-letter tile, not a score row (§237)', async () => {
    const onCoverLetter = jest.fn();
    await wrap(
      <TailorReady company="Stripe" next={<BuildNextTiles onCoverLetter={onCoverLetter} />} />,
    );
    expect(screen.getByText('Your resume for Stripe is ready')).toBeOnTheScreen();
    expect(screen.queryByText(/^ATS score/)).toBeNull();
    expect(screen.queryByText(/^Next: download it/)).toBeNull();
    expect(screen.queryByLabelText('Practice the interview')).toBeNull();
    await act(async () => fireEvent.press(screen.getByLabelText('Make a cover letter')));
    expect(onCoverLetter).toHaveBeenCalled();
  });
});
