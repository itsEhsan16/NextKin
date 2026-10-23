import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { NotFoundScreen } from '@/features/system';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  Link: ({ children }: PropsWithChildren) => children,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('NotFoundScreen (SYSTEM 01)', () => {
  afterEach(async () => {
    await cleanup();
    mockReplace.mockClear();
  });

  it('names the dead end and replaces it with Home', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <NotFoundScreen />
      </SafeAreaProvider>,
    );

    expect(screen.getByRole('header', { name: 'Page not found' })).toBeOnTheScreen();
    expect(screen.getByText('The link you followed does not match any screen.')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Go to Home'));
    // A replace, so Back from Home never lands on the dead link again.
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
