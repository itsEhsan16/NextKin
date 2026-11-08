import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { CreateSheetProvider, FloatingTabBar, useTabScrollToTop, type TabName } from '@/navigation';
import { lightTheme } from '@/theme';

// jest.mock factories are hoisted, so they may only close over `mock*`-prefixed bindings.
const mockNavigate = jest.fn();
const mockRouter = { segments: ['(tabs)'] as string[] };

jest.mock('expo-router', () => ({
  useRouter: () => ({
    navigate: mockNavigate,
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSegments: () => mockRouter.segments,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Stands in for a tab screen, which registers its scroll handler while mounted. */
function ScrollProbe({ tab, onScroll }: { tab: TabName; onScroll: () => void }) {
  useTabScrollToTop(tab, onScroll);
  return null;
}

/** The bar is self-driven now — only the current route segments decide which tab is active. */
async function renderBar(segments: string[], probe?: ReactNode) {
  mockRouter.segments = segments;
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <CreateSheetProvider>
        {probe}
        <FloatingTabBar />
      </CreateSheetProvider>
    </SafeAreaProvider>,
  );
}

/**
 * The pill's absolutely-positioned host, which owns the sheet-aware a11y and pointer flags.
 * Found by walking up from a tab: RNTL does not match "tablist" via getByRole.
 */
function host() {
  let node = screen.getAllByRole('tab')[0]?.parent;
  while (node && node.props.pointerEvents === undefined) node = node.parent;
  return node;
}

describe('FloatingTabBar', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('renders the four tabs with the active one selected', async () => {
    await renderBar(['(tabs)']);

    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: 'Home' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Jobs' })).not.toBeSelected();
  });

  it('derives the active tab from the router segments', async () => {
    await renderBar(['(tabs)', 'resumes']);

    expect(screen.getByRole('tab', { name: 'Resumes' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Home' })).not.toBeSelected();
  });

  it('navigates to the typed href when an inactive tab is pressed', async () => {
    await renderBar(['(tabs)']);

    fireEvent.press(screen.getByRole('tab', { name: 'Resumes' }));

    // One frame later, so the highlight paints before the navigation's render.
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/resumes'));
  });

  it('is the one place that vibrates: one selection tick per tab press (§191)', async () => {
    jest.mocked(Haptics.selectionAsync).mockClear();
    await renderBar(['(tabs)']);

    fireEvent.press(screen.getByRole('tab', { name: 'Jobs' }));
    await waitFor(() => expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1));
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('glides the gradient pill to the tab you pick, before the route catches up (§193)', async () => {
    await renderBar(['(tabs)']);
    const pill = screen.getByTestId('tab-light', { includeHiddenElements: true });
    const left = () => Number(StyleSheet.flatten(pill.props.style).left);
    const atHome = left();

    fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    await waitFor(() => expect(left()).toBeGreaterThan(atHome));
  });

  it('selects the pressed tab before the route catches up', async () => {
    await renderBar(['(tabs)']);

    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));

    // The segments still say Home: the highlight no longer waits for the screen to mount.
    expect(screen.getByRole('tab', { name: 'Profile' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Home' })).not.toBeSelected();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/profile'));
  });

  it('drops the pressed highlight once the route moves', async () => {
    await renderBar(['(tabs)']);
    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());

    // The route lands somewhere else entirely (a link elsewhere won the race): the route wins.
    mockRouter.segments = ['(tabs)', 'jobs'];
    await screen.rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <CreateSheetProvider>
          <FloatingTabBar />
        </CreateSheetProvider>
      </SafeAreaProvider>,
    );

    expect(screen.getByRole('tab', { name: 'Jobs' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Profile' })).not.toBeSelected();
  });

  it('scrolls the focused tab to the top instead of re-navigating to itself', async () => {
    const scrollToTop = jest.fn();
    await renderBar(['(tabs)', 'jobs'], <ScrollProbe tab="jobs" onScroll={scrollToTop} />);

    fireEvent.press(screen.getByRole('tab', { name: 'Jobs' }));

    expect(scrollToTop).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates past an unfocused tab without touching its scroll handler', async () => {
    const scrollToTop = jest.fn();
    await renderBar(['(tabs)', 'jobs'], <ScrollProbe tab="index" onScroll={scrollToTop} />);

    fireEvent.press(screen.getByRole('tab', { name: 'Home' }));

    expect(scrollToTop).not.toHaveBeenCalled();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/(tabs)'));
  });

  it('is inert on a re-tap when the focused tab has nothing scrollable', async () => {
    await renderBar(['(tabs)', 'jobs']);

    fireEvent.press(screen.getByRole('tab', { name: 'Jobs' }));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('draws the selected tab in white on the gradient and the rest in ink (§193)', async () => {
    await renderBar(['(tabs)', 'jobs']);

    // Each label has a white copy and an ink copy that cross-fade; the selected tab shows white.
    const shownOpacity = (label: string, color: string) => {
      const copy = screen
        .getAllByText(label, { includeHiddenElements: true })
        .find((node) => StyleSheet.flatten(node.props.style).color === color);
      let node = copy?.parent;
      while (node && StyleSheet.flatten(node.props.style)?.opacity === undefined)
        node = node.parent;
      return StyleSheet.flatten(node?.props.style)?.opacity;
    };
    await waitFor(() => expect(shownOpacity('Jobs', lightTheme.colors.textOnBrand)).toBe(1));
    expect(shownOpacity('Home', lightTheme.colors.textOnBrand)).toBe(0);
    expect(lightTheme.colors.navInactive).not.toBe(lightTheme.colors.textOnBrand);
  });

  it('names each tab once for assistive tech; the label copies are drawing only', async () => {
    await renderBar(['(tabs)', 'jobs']);

    // Two drawn copies per label (white and ink) for the cross-fade, both hidden: the tab itself
    // carries the name.
    expect(screen.getAllByText('Jobs', { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.queryAllByText('Jobs')).toHaveLength(0);
    expect(screen.getByRole('tab', { name: 'Jobs', selected: true })).toBeOnTheScreen();
  });

  it('stays interactive and readable, leaving open sheets to the tabs layout', async () => {
    await renderBar(['(tabs)']);

    // Every hosted sheet, the create sheet included, now paints over the pill; the layout's
    // ChromeLayer takes it out of reach and out of the a11y tree, so the bar sets neither itself.
    expect(host()?.props.pointerEvents).toBe('box-none');
    expect(host()?.props.accessibilityElementsHidden).toBeUndefined();
    expect(host()?.props.importantForAccessibility).toBeUndefined();
  });
});
