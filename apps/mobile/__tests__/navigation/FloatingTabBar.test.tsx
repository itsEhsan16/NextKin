import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import {
  CreateSheetProvider,
  FloatingTabBar,
  useTabScrollToTop,
  type TabName,
} from '@/navigation';

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

    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/resumes');
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
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)');
  });

  it('is inert on a re-tap when the focused tab has nothing scrollable', async () => {
    await renderBar(['(tabs)', 'jobs']);

    fireEvent.press(screen.getByRole('tab', { name: 'Jobs' }));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('stays interactive and readable while the create sheet is closed', async () => {
    await renderBar(['(tabs)']);

    // Figma paints the pill above the sheet, so it must be explicitly neutralised when the
    // sheet opens — otherwise a tab press would navigate behind an open modal.
    expect(host()?.props.pointerEvents).toBe('box-none');
    expect(host()?.props.accessibilityElementsHidden).toBe(false);
    expect(host()?.props.importantForAccessibility).toBe('auto');
  });
});
