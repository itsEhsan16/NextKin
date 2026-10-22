import { fireEvent, render, screen } from '@testing-library/react';

import type { ServiceStatus } from '@nextkin/shared/queries';

import { ServiceBanner } from '@/features/system/ServiceBanner';

let mockStatus: ServiceStatus | undefined;

jest.mock('@nextkin/shared/queries', () => ({
  ...jest.requireActual('@nextkin/shared/queries'),
  useServiceStatus: () => ({ data: mockStatus }),
}));

const AI = 'Writing and checking are paused or slower than usual.';
const PAY = 'Upgrades are paused for a moment.';

// The degraded-mode banner (P13-02): one notice for every degraded capability, until dismissed.
describe('ServiceBanner', () => {
  it('shows nothing when nothing is degraded, or in mock mode (no status)', () => {
    mockStatus = { status: 'ok', capabilities: [{ capability: 'ai', degraded: false }] };
    const { unmount } = render(<ServiceBanner />);
    expect(screen.queryByRole('status')).toBeNull();
    unmount();
    mockStatus = undefined;
    render(<ServiceBanner />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says what is degraded, and Dismiss hides it', () => {
    mockStatus = {
      status: 'degraded',
      capabilities: [
        { capability: 'ai', degraded: true, message: AI },
        { capability: 'jobs', degraded: false },
        { capability: 'payments', degraded: true, message: PAY },
      ],
    };
    render(<ServiceBanner />);
    expect(screen.getByRole('status')).toHaveTextContent(`${AI} ${PAY}`);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
