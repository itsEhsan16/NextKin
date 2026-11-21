import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

/** Android, deliberately: it is the platform with a store to send people to (toreview §245). */
jest.mock('react-native/Libraries/Utilities/Platform', () => {
  const actual = jest.requireActual('react-native/Libraries/Utilities/Platform');
  const base = actual.default ?? actual;
  return { ...base, OS: 'android', __esModule: true, default: { ...base, OS: 'android' } };
});

const mockPolicy: { data: { minimum: string | null; latest: string | null } | undefined } = {
  data: undefined,
};
jest.mock('@/data/queries/useAppVersionPolicy', () => ({
  useAppVersionPolicy: () => mockPolicy,
}));

/* eslint-disable import/first -- must follow the mocks above. */
import { createQueryClient } from '@/data/queries';
import { useUpgradeRequired } from '@/data/upgradeRequired';
import {
  AVAILABLE_TITLE,
  AppUpdateHost,
  REQUIRED_MESSAGE,
  REQUIRED_TITLE,
} from '@/features/system/AppUpdateHost';
import { compareVersions, updateState } from '@/features/system/appUpdate';
import { storage } from '@/lib';
/* eslint-enable import/first */

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const clients: QueryClient[] = [];
/** StateView fades in on Reanimated, whose mock leaves it at opacity 0: queries read it as hidden. */
const HIDDEN = { includeHiddenElements: true } as const;

async function renderHost() {
  const client = createQueryClient();
  clients.push(client);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={client}>
        <AppUpdateHost />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe('version maths', () => {
  it('compares dotted numbers, not strings', () => {
    expect(compareVersions('1.10.0', '1.9.3')).toBe(1);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.9.9', '1.0.0')).toBe(-1);
  });

  it('decides between nothing, an offer and a required update', () => {
    const at = (
      policy: { minimum: string | null; latest: string | null },
      dismissed: string | null = null,
    ) => updateState({ policy, forced: false, current: '1.1.0', dismissed });
    expect(at({ minimum: null, latest: null })).toBe('none');
    expect(at({ minimum: '1.0.0', latest: '1.1.0' })).toBe('none');
    expect(at({ minimum: '1.0.0', latest: '1.2.0' })).toBe('available');
    expect(at({ minimum: '1.0.0', latest: '1.2.0' }, '1.2.0')).toBe('none');
    expect(at({ minimum: '1.0.0', latest: '1.3.0' }, '1.2.0')).toBe('available');
    expect(at({ minimum: '1.2.0', latest: '1.2.0' }, '1.2.0')).toBe('required');
    expect(
      updateState({ policy: undefined, forced: true, current: '9.0.0', dismissed: null }),
    ).toBe('required');
  });
});

describe('AppUpdateHost (toreview §245)', () => {
  beforeEach(() => {
    mockPolicy.data = undefined;
    useUpgradeRequired.setState({ required: false, minimumVersion: null });
    storage.remove('appUpdate.dismissed');
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await cleanup();
    clients.splice(0).forEach((client) => client.clear());
    jest.restoreAllMocks();
  });

  it('says nothing when there is nothing newer', async () => {
    await renderHost();
    expect(screen.queryByText(REQUIRED_TITLE, HIDDEN)).toBeNull();
    expect(screen.queryByText(AVAILABLE_TITLE, HIDDEN)).toBeNull();
  });

  it('covers the app with only the update once a request was answered 426', async () => {
    await renderHost();
    await act(async () => useUpgradeRequired.getState().require('2.0.0'));
    expect(screen.getByText(REQUIRED_TITLE, HIDDEN)).toBeOnTheScreen();
    expect(screen.getByText(REQUIRED_MESSAGE, HIDDEN)).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Update', HIDDEN));
    // The package is the build's own (expo-application); the mock names it 'mock'.
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringMatching(/^market:\/\/details\?id=/));
  });

  it('offers a newer store version once, and "Not now" holds until the next release', async () => {
    mockPolicy.data = { minimum: '0.0.0', latest: '99.0.0' };
    await renderHost();
    expect(screen.getByText(AVAILABLE_TITLE)).toBeOnTheScreen();
    // Only what "Not now" does is under test: a store open left over from the suite's earlier
    // test can land on this spy.
    (Linking.openURL as jest.Mock).mockClear();
    fireEvent.press(screen.getByText('Not now'));
    expect(storage.get('appUpdate.dismissed')).toBe('99.0.0');
    expect((Linking.openURL as jest.Mock).mock.calls).toEqual([]);
  });
});
