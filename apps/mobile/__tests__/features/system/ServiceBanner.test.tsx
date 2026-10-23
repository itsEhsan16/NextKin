import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
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
