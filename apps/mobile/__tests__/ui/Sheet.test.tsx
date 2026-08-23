import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { Sheet } from '@/ui/Sheet';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderSheet(open: boolean, onClose = jest.fn()) {
  const ui = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Sheet open={open} onClose={onClose} height={400} accessibilityLabel="Create">
        <Text>Sheet body</Text>
      </Sheet>
    </SafeAreaProvider>,
  );
  return { ...ui, onClose };
}

describe('Sheet', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('renders nothing while closed', async () => {
    await renderSheet(false);
    expect(screen.queryByText('Sheet body')).toBeNull();
  });

  it('mounts its content when open and closes on scrim tap', async () => {
    const { onClose } = await renderSheet(true);
    expect(screen.getByText('Sheet body')).toBeOnTheScreen();
    expect(screen.getByLabelText('Create')).toBeOnTheScreen();

    // The scrim fades in via Reanimated; under the jest mock its opacity stays 0 ("hidden").
    fireEvent.press(screen.getByLabelText('Close sheet', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
