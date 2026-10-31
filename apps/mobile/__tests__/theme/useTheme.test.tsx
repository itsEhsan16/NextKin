import { renderHook } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';

import { storage } from '@/lib';
import { darkTheme, lightTheme, useTheme } from '@/theme';

// `react-native`'s `useColorScheme` getter requires this module and returns its
// default export, so mocking the file swaps the hook any code would read the OS scheme from.
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

// RNTL 14 renders asynchronously (React 19): renderHook / rerender / act all return promises.

const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

type OsScheme = ReturnType<typeof useColorScheme>;

const setOsScheme = (scheme: string | null | undefined) => {
  // RN types `useColorScheme` as one of its names, but the runtime can hand back null/undefined
  // before the OS reports one, or a value the type no longer lists ('unspecified').
  mockedUseColorScheme.mockReturnValue(scheme as OsScheme);
};

const renderTheme = () => renderHook(() => useTheme());

beforeEach(() => {
  setOsScheme('light');
});

afterEach(() => {
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
    expect(theme.shadows.fab).toBeDefined();
    expect(theme.opacity.disabled).toBeGreaterThan(0);
    expect(theme.zIndex.sheet).toBeGreaterThan(theme.zIndex.tabBar);
    expect(theme.typography.title.fontFamily).toBe(theme.fontFamily.semiBold);
    expect(theme.motion.springs.sheetIn.dampingRatio).toBe(0.8);
  });

  // The app is light only (owner, 2026-10-25): the phone's dark mode must change nothing.
  it('stays light when the OS is in dark mode', async () => {
    setOsScheme('dark');
    const { result } = await renderTheme();
    expect(result.current?.scheme).toBe('light');
    expect(result.current).toBe(lightTheme);
    expect(result.current).not.toBe(darkTheme);
  });

  it('stays light when the OS switches to dark while mounted', async () => {
    const { result, rerender } = await renderTheme();
    const first = result.current;

    setOsScheme('dark');
    await rerender(undefined);

    expect(result.current?.scheme).toBe('light');
    expect(result.current).toBe(first);
  });

  it('ignores a dark appearance saved by an older build', async () => {
    storage.set('prefs.appearance', 'dark');
    const { result } = await renderTheme();
    expect(result.current).toBe(lightTheme);
  });

  it('stays light for an unknown OS scheme', async () => {
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

  it('keeps a stable theme identity across re-renders', async () => {
    const { result, rerender } = await renderTheme();
    const first = result.current;
    expect(first).toBeDefined();
    await rerender(undefined);
    expect(result.current).toBe(first);
  });
});
