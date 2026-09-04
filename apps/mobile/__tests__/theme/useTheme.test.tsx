import { act, renderHook } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';

import { storage } from '@/lib';
import {
  darkTheme,
  lightTheme,
  useAppearanceStore,
  useResolvedScheme,
  useTheme,
  type AppearancePreference,
} from '@/theme';

// `react-native`'s `useColorScheme` getter requires this module and returns its
// default export, so mocking the file swaps the hook the theme reads from.
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

// RNTL 14 renders asynchronously (React 19): renderHook / rerender / act all return promises.

const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

type OsScheme = ReturnType<typeof useColorScheme>;

const setOsScheme = (scheme: OsScheme | null | undefined) => {
  // RN types `useColorScheme` as always returning a name, but the runtime can
  // hand back null/undefined before the OS reports one; the theme must cope.
  mockedUseColorScheme.mockReturnValue(scheme as OsScheme);
};

const setPreference = (preference: AppearancePreference) =>
  act(() => {
    useAppearanceStore.getState().setPreference(preference);
  });

const renderTheme = () => renderHook(() => useTheme());

beforeEach(() => {
  setOsScheme('light');
  useAppearanceStore.setState({ preference: 'system' });
});

afterEach(() => {
  useAppearanceStore.setState({ preference: 'system' });
  storage.remove('prefs.appearance');
});

describe('useTheme', () => {
  it('returns the light theme by default', async () => {
    const { result } = await renderTheme();
    expect(result.current?.scheme).toBe('light');
    expect(result.current).toBe(lightTheme);
    expect(result.current?.colors).toBe(lightTheme.colors);
  });

  it('exposes every token group on the theme object', async () => {
    const { result } = await renderTheme();
    const theme = result.current;
    expect(theme).toBeDefined();
    if (!theme) return;
    expect(theme.spacing.gutter).toBe(24);
    expect(theme.radii.card).toBe(20);
    expect(theme.sizes.tabBarHeight).toBeCloseTo(90.396, 3);
    expect(theme.shadows.tabBar).toBeDefined();
    expect(theme.opacity.disabled).toBeGreaterThan(0);
    expect(theme.zIndex.sheet).toBeGreaterThan(theme.zIndex.tabBar);
    expect(theme.typography.title.fontFamily).toBe(theme.fontFamily.semiBold);
    expect(theme.motion.springs.sheetIn.dampingRatio).toBe(0.8);
  });

  it('switches to the dark theme when the appearance preference is set to dark', async () => {
    const { result } = await renderTheme();
    expect(result.current?.scheme).toBe('light');

    await setPreference('dark');

    expect(result.current?.scheme).toBe('dark');
    expect(result.current).toBe(darkTheme);
    expect(result.current?.colors.surfacePage).toBe(darkTheme.colors.surfacePage);
  });

  it('forces light when the preference is light even if the OS is dark', async () => {
    setOsScheme('dark');
    const { result } = await renderTheme();
    expect(result.current?.scheme).toBe('dark');

    await setPreference('light');

    expect(result.current?.scheme).toBe('light');
    expect(result.current).toBe(lightTheme);
  });

  it('follows the OS colour scheme after resetting the preference to system', async () => {
    setOsScheme('dark');
    const { result, rerender } = await renderTheme();

    await setPreference('light');
    expect(result.current?.scheme).toBe('light');

    await setPreference('system');
    expect(result.current?.scheme).toBe('dark');

    setOsScheme('light');
    await rerender(undefined);
    expect(result.current?.scheme).toBe('light');

    setOsScheme('dark');
    await rerender(undefined);
    expect(result.current?.scheme).toBe('dark');
  });

  it('treats an unknown OS scheme as light while following the system', async () => {
    setOsScheme('unspecified');
    const { result, rerender } = await renderTheme();
    expect(result.current?.scheme).toBe('light');

    setOsScheme(null);
    await rerender(undefined);
    expect(result.current?.scheme).toBe('light');

    setOsScheme(undefined);
    await rerender(undefined);
    expect(result.current?.scheme).toBe('light');
  });

  it('ignores OS scheme changes while an explicit preference is set', async () => {
    const { result, rerender } = await renderTheme();
    await setPreference('dark');

    setOsScheme('light');
    await rerender(undefined);
    expect(result.current?.scheme).toBe('dark');

    setOsScheme('dark');
    await rerender(undefined);
    expect(result.current?.scheme).toBe('dark');
  });

  it('keeps a stable theme identity across re-renders with the same scheme', async () => {
    const { result, rerender } = await renderTheme();
    const first = result.current;
    expect(first).toBeDefined();
    await rerender(undefined);
    expect(result.current).toBe(first);
  });

  it('persists the chosen preference through storage', async () => {
    await renderTheme();
    await setPreference('dark');
    expect(storage.get<AppearancePreference>('prefs.appearance')).toBe('dark');

    await setPreference('system');
    expect(storage.get<AppearancePreference>('prefs.appearance')).toBe('system');
  });
});

describe('useResolvedScheme', () => {
  it('resolves the same scheme the theme hook uses', async () => {
    setOsScheme('dark');
    const { result } = await renderHook(() => ({
      resolved: useResolvedScheme(),
      theme: useTheme(),
    }));
    expect(result.current?.resolved).toBe('dark');
    expect(result.current?.theme.scheme).toBe('dark');

    await setPreference('light');
    expect(result.current?.resolved).toBe('light');
    expect(result.current?.theme.scheme).toBe('light');
  });
});
