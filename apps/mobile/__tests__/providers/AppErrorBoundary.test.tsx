import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  APP_ERROR_MESSAGE,
  APP_ERROR_RETRY,
  APP_ERROR_TITLE,
  AppErrorBoundary,
} from '@/providers/AppErrorBoundary';

/**
 * StateView enters on a layout animation and hides its duplicated message from screen readers,
 * and the queries read both as hidden. The fallback is on screen; this lets them see it.
 */
const shown = { includeHiddenElements: true } as const;

let shouldThrow = true;

function FlakyScreen() {
  if (shouldThrow) throw new Error('render failed');
  return <Text>Home</Text>;
}

describe('AppErrorBoundary', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    shouldThrow = true;
    // React and the boundary both log the caught error; keep the run's output readable.
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleError.mockRestore();
    await cleanup();
  });

  it('catches a screen that throws, says so, and recovers on Try again', async () => {
    await render(
      <AppErrorBoundary>
        <FlakyScreen />
      </AppErrorBoundary>,
    );

    expect(screen.getByText(APP_ERROR_TITLE, shown)).toBeOnTheScreen();
    expect(screen.getByText(APP_ERROR_MESSAGE, shown)).toBeOnTheScreen();
    expect(screen.queryByText('Home')).toBeNull();
    // The error is logged so it reaches the Metro terminal.
    expect(consoleError.mock.calls.some(([tag]) => tag === '[AppErrorBoundary]')).toBe(true);

    shouldThrow = false;
    await fireEvent.press(screen.getByText(APP_ERROR_RETRY, shown));

    expect(screen.getByText('Home')).toBeOnTheScreen();
    expect(screen.queryByText(APP_ERROR_TITLE, shown)).toBeNull();
  });

  it('renders its children untouched when nothing throws', async () => {
    shouldThrow = false;
    await render(
      <AppErrorBoundary>
        <FlakyScreen />
      </AppErrorBoundary>,
    );

    expect(screen.getByText('Home')).toBeOnTheScreen();
    expect(screen.queryByText(APP_ERROR_TITLE, shown)).toBeNull();
  });
});
