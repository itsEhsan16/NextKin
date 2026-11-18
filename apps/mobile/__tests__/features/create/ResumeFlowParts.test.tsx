import { act, cleanup, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { TailorRun } from '@/data/models';
import { ProgressButton, READ_STAGES } from '@/features/create/flow/ProgressButton';
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

  it('says the finished score as the web does: band, move, key keywords, a missed plan, next', async () => {
    const run = {
      sourceResumeId: 'res_base',
      baselineScore: 67,
      projected: 90,
      jobMatch: { matched: 8, total: 10, percent: 80, missing: ['Kafka', 'Go'], basis: '' },
      next: [{ title: 'Add a result to a bullet', worth: 0.3 }],
      added: [],
      skipped: [],
    } as unknown as TailorRun;
    await wrap(<TailorReady run={run} company="Stripe" score={78} onSeeChanges={() => {}} />);
    expect(screen.getByText('ATS score · Good match')).toBeOnTheScreen();
    expect(screen.getByText('6.7 → 7.8')).toBeOnTheScreen();
    expect(screen.getByText('8 of 10 key keywords · Plan aimed for 9.0')).toBeOnTheScreen();
    expect(
      screen.getByText('Next: Add a result to a bullet (+0.3). Yours to accept.'),
    ).toBeOnTheScreen();
  });
});
