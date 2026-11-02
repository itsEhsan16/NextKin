import { onlineManager } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { ServiceStatus } from '@nextkin/shared/queries';

import { ServiceBanner } from '@/features/system/ServiceBanner';

let mockStatus: ServiceStatus | undefined;

jest.mock('@/data/queries', () => ({
  ...jest.requireActual('@/data/queries'),
  useBackendServiceStatus: () => ({ data: mockStatus }),
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const AI = 'Writing and checking are paused or slower than usual.';
const PAY = 'Upgrades are paused for a moment.';

const renderBanner = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ServiceBanner />
    </SafeAreaProvider>,
  );

// The degraded-mode banner (P13-02): one note for every degraded capability, hidden by a tap.
describe('ServiceBanner', () => {
  afterEach(async () => {
    await cleanup();
    onlineManager.setOnline(true);
  });

  it('says so with no connection, whatever else is going on, and clears when it returns', async () => {
    mockStatus = {
      status: 'degraded',
      capabilities: [{ capability: 'ai', degraded: true, message: AI }],
    };
    await renderBanner();
    expect(screen.getByLabelText(new RegExp(AI))).toBeOnTheScreen();

    await act(async () => onlineManager.setOnline(false));
    expect(
      screen.getByText('You’re offline. Resumes open again once you’re back online.'),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText(new RegExp(AI))).toBeNull();

    await act(async () => onlineManager.setOnline(true));
    expect(screen.queryByText(/offline/)).toBeNull();
    expect(screen.getByLabelText(new RegExp(AI))).toBeOnTheScreen();
  });

  it('brings the offline note back the next time the connection drops', async () => {
    mockStatus = undefined;
    await renderBanner();

    await act(async () => onlineManager.setOnline(false));
    await act(async () => fireEvent.press(screen.getByRole('button', { name: /offline/ })));
    expect(screen.queryByText(/offline/)).toBeNull();

    await act(async () => onlineManager.setOnline(true));
    await act(async () => onlineManager.setOnline(false));
    expect(screen.getByText(/offline/)).toBeOnTheScreen();
  });

  it('shows nothing when nothing is degraded, or in mock mode (no status)', async () => {
    mockStatus = { status: 'ok', capabilities: [{ capability: 'ai', degraded: false }] };
    await renderBanner();
    expect(screen.queryByRole('button')).toBeNull();
    await cleanup();
    mockStatus = undefined;
    await renderBanner();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says what is degraded, and a tap hides it', async () => {
    mockStatus = {
      status: 'degraded',
      capabilities: [
        { capability: 'ai', degraded: true, message: AI },
        { capability: 'jobs', degraded: false },
        { capability: 'payments', degraded: true, message: PAY },
      ],
    };
    await renderBanner();
    const banner = screen.getByRole('button', { name: `${AI} ${PAY} Tap to hide.` });
    expect(screen.getByText(`${AI} ${PAY}`)).toBeOnTheScreen();
    await fireEvent.press(banner);
    expect(screen.queryByText(`${AI} ${PAY}`)).toBeNull();
  });
});
