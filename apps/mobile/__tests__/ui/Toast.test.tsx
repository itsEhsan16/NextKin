import { act, cleanup, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { Toast } from '@/ui/Toast';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const tree = (props: { message: string; onHide: () => void }) => (
  <SafeAreaProvider initialMetrics={metrics}>
    <Toast visible durationMs={3000} {...props} />
  </SafeAreaProvider>
);

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());

  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
  });

  it('hides on time even when its host re-renders with a new inline onHide', async () => {
    const hidden = jest.fn();
    await render(tree({ message: 'Saved', onHide: () => hidden() }));

    // A run screen re-renders on every 1.2 s progress tick, each time with a fresh closure.
    for (let tick = 0; tick < 2; tick += 1) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(1200);
      });
      await screen.rerender(tree({ message: 'Saved', onHide: () => hidden() }));
    }
    await act(async () => {
      await jest.advanceTimersByTimeAsync(700);
    });

    expect(hidden).toHaveBeenCalledTimes(1);
  });

  it('gives a new message its full time on screen', async () => {
    const hidden = jest.fn();
    await render(tree({ message: 'Saved', onHide: hidden }));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });

    await screen.rerender(tree({ message: 'Link copied', onHide: hidden }));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });
    expect(hidden).not.toHaveBeenCalled();
    expect(screen.getByText('Link copied')).toBeOnTheScreen();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(hidden).toHaveBeenCalledTimes(1);
  });
});
