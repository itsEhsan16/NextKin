import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { Fab } from '@/navigation/Fab';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('Fab — the AI assistant button (New Navigation 669:49)', () => {
  afterEach(async () => {
    await cleanup();
    mockPush.mockClear();
  });

  it('opens the assistant chat, and no longer offers to create', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <Fab />
      </SafeAreaProvider>,
    );

    expect(screen.queryByLabelText('Create')).toBeNull();
    fireEvent.press(screen.getByLabelText('AI assistant'));
    expect(mockPush).toHaveBeenCalledWith('/assistant');
  });
});
