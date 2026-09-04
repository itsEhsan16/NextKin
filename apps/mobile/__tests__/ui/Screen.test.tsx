import { render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { themeFor } from '@/theme';
import { Screen } from '@/ui/Screen';

import { insideScroller } from '../../testSupport/scroller';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** `Screen` sizes off the window, which jest reports as 750 — clamped to the artboard, so scale 1. */
const theme = themeFor('light', Dimensions.get('window').width);

/** RTL 14 renders asynchronously — every call site must await this or `screen` stays empty. */
const renderScreen = async (node: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={metrics}>{node}</SafeAreaProvider>);

/** `react-test-renderer` types are not installed, so the instance type comes off a query. */
type Instance = ReturnType<typeof screen.getByLabelText>;

const flat = (value: unknown): Record<string, unknown> =>
  (StyleSheet.flatten(value as StyleProp<ViewStyle>) ?? {}) as Record<string, unknown>;

/** The box `header` renders in: the immediate parent of the node handed to the prop. */
const headerBox = () => screen.getByLabelText('pinned').parent as Instance;

const scrollerAbove = (node: Instance): Instance => {
  for (let n = node.parent; n; n = n.parent) if (n.type === 'RCTScrollView') return n;
  throw new Error('expected a scroll container above this node');
};

const pinned = <View accessibilityLabel="pinned" />;
const body = <View accessibilityLabel="body" />;

/**
 * The pinned-header contract.
 *
 * "Pinned" is a structural claim, not a style: the header is a sibling *above* the scroller, so
 * the scroll viewport begins at its bottom edge and no offset can move it. These assertions are
 * what stop a future refactor quietly turning it back into a `stickyHeaderIndices` child, which
 * would look identical at rest and travel on every scroll frame.
 */
describe('Screen — pinned header', () => {
  it('renders the header above the scroller rather than inside it', async () => {
    await renderScreen(
      <Screen scroll header={pinned}>
        {body}
      </Screen>,
    );

    expect(insideScroller(screen.getByLabelText('pinned'))).toBe(false);
    // The other half: without it, pinning the entire page would pass.
    expect(insideScroller(screen.getByLabelText('body'))).toBe(true);
  });

  it('gives the header box the same gutter, width cap and centring as the scroll content', async () => {
    await renderScreen(
      <Screen scroll header={pinned}>
        {body}
      </Screen>,
    );

    // The two columns of rows have to line up, or the pinned title sits off the content below it.
    const box = flat(headerBox().props.style);
    const content = flat(scrollerAbove(screen.getByLabelText('body')).props.contentContainerStyle);

    expect(box.paddingHorizontal).toBe(theme.spacing.gutter);
    expect(box.paddingHorizontal).toBe(content.paddingHorizontal);
    expect(box.maxWidth).toBe(theme.sizes.designWidth);
    expect(box.alignSelf).toBe('center');
  });

  it('never puts the tab-bar inset or a flex on the header box', async () => {
    await renderScreen(
      <Screen scroll tabBarInset header={pinned}>
        {body}
      </Screen>,
    );

    const box = flat(headerBox().props.style);
    const content = flat(scrollerAbove(screen.getByLabelText('body')).props.contentContainerStyle);

    // The inset is a reservation at the far end of the scroll run. On the header it would be
    // ~136dp of dead white at the top of the page, stolen from the scroll viewport as well.
    expect(content.paddingBottom).toBeGreaterThan(0);
    expect(box.paddingBottom).toBeUndefined();
    // A `flex: 1` header takes half the viewport and starves the scroller.
    expect(box.flex).toBeUndefined();
  });

  it('keeps the header out of the way entirely when none is passed', async () => {
    // The prop is additive: six screens never pass it and must render exactly as before.
    await renderScreen(<Screen scroll>{body}</Screen>);

    expect(screen.queryByLabelText('pinned')).toBeNull();
    expect(insideScroller(screen.getByLabelText('body'))).toBe(true);
  });

  it('renders a header in the non-scroll variant without doubling the gutter', async () => {
    // Jobs is `padded={false}` and hosts its own list, so the header lands on the static path.
    // There the root already carries the content box, so the header box takes `headerStyle`
    // alone — re-applying the gutter here would draw it twice.
    await renderScreen(
      <Screen header={pinned} headerStyle={{ paddingTop: 7 }}>
        {body}
      </Screen>,
    );

    const box = flat(headerBox().props.style);
    expect(box.paddingTop).toBe(7);
    expect(box.paddingHorizontal).toBeUndefined();
  });
});
