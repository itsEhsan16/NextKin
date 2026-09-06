import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { HomeMenuHost, useHomeStore } from '@/features/home';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const INITIAL = useHomeStore.getState();

async function renderMenu() {
  useHomeStore.setState({ menuOpen: true });
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <HomeMenuHost />
    </SafeAreaProvider>,
  );
}

const press = (label: string) =>
  act(
    async () => void fireEvent.press(screen.getByLabelText(label, { includeHiddenElements: true })),
  );

const shows = (label: string) =>
  screen.queryByLabelText(label, { includeHiddenElements: true }) !== null;

/** Every row and where it lands. The AI rows carry the badge in their name, like the create sheet. */
const ROWS: readonly [label: string, route: string][] = [
  ['History', '/history'],
  ['Interview prep, AI powered', '/interview'],
  ['AI assistant, AI powered', '/assistant'],
  ['NextKin Pro', '/upgrade'],
  ['Help & FAQ', '/support/help'],
  ['Contact support', '/support/contact'],
];

describe('HomeMenuHost (plan §8, phase 9I — the hamburger sheet)', () => {
  beforeEach(() => {
    useHomeStore.setState(INITIAL, true);
    mockPush.mockClear();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('lists six real destinations, and closes on the close control without navigating', async () => {
    await renderMenu();

    for (const [label] of ROWS) expect(shows(label)).toBe(true);

    await press('Close menu');
    expect(useHomeStore.getState().menuOpen).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
  });

  // One mount per press, like the other sheet hosts: a sheet closed and reopened inside one
  // test never finishes its exit under the Reanimated mock.
  it.each(ROWS)('"%s" closes the sheet and pushes %s', async (label, route) => {
    await renderMenu();

    await press(label);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(route);
    expect(useHomeStore.getState().menuOpen).toBe(false);
  });
});
