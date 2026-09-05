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

/** The bar handed to `footer`. */
const action = <View accessibilityLabel="action" />;

/** The box `footer` renders in: the immediate parent of the node handed to the prop. */
const footerBox = () => screen.getByLabelText('action').parent as Instance;

/**
 * The page box: the ancestor carrying `safeAreaStyle`, identified by the top inset it pads.
 *
 * Named by its style rather than by depth, so it keeps working when `keyboard` swaps the root
 * element out for a different one.
 */
const safeAreaBox = (node: Instance): Instance => {
  for (let n = node.parent; n; n = n.parent) {
    if (flat(n.props.style).paddingTop === metrics.insets.top) return n;
  }
  throw new Error('expected a safe-area padded box above this node');
};

/**
 * The form skeleton every Phase 9B–9I screen is built on.
 *
 * Both halves are structural claims, like the header's above. The footer proves it is pinned by
 * living outside the scroller; the keyboard wrapper proves itself by the frame measurement only a
 * `KeyboardAvoidingView` leaves behind, one level *above* the safe-area box. Neither shows up in a
 * screenshot at rest, which is why they are pinned here.
 */
describe('Screen — footer and keyboard', () => {
  it('renders the footer below the scroller rather than inside it', async () => {
    await renderScreen(
      <Screen scroll footer={action}>
        {body}
      </Screen>,
    );

    expect(insideScroller(screen.getByLabelText('action'))).toBe(false);
    // The other half again: pinning the whole page would otherwise pass.
    expect(insideScroller(screen.getByLabelText('body'))).toBe(true);
  });

  it('leaves the footer box full-bleed instead of framing it like the header', async () => {
    await renderScreen(
      <Screen scroll footer={action} footerStyle={{ paddingTop: 7 }}>
        {body}
      </Screen>,
    );

    // The mirror image of the header's frame test above. The header takes the gutter so its rows
    // line up with the content below; the bar must not, because its hairline and upward shadow
    // read as the bottom of the *window* — framed, it would stop 24pt short of both edges and cap
    // itself at the artboard width on a tablet.
    const box = flat(footerBox().props.style);

    expect(box.paddingHorizontal).toBeUndefined();
    expect(box.maxWidth).toBeUndefined();
    expect(box.alignSelf).toBeUndefined();
    // And the box is still the screen's to style — the bar's own padding lives in here.
    expect(box.paddingTop).toBe(7);
  });

  it('hands the bottom inset to the footer', async () => {
    await renderScreen(
      <Screen scroll edges={['top', 'bottom']} footer={action}>
        {body}
      </Screen>,
    );

    // The bar pads `spacing[4] + insets.bottom` itself so its background reaches the bottom of
    // the glass. Padding the page as well would park it above a 34pt strip of bare page.
    expect(flat(safeAreaBox(screen.getByLabelText('body')).props.style).paddingBottom).toBe(0);
  });

  it('keeps the bottom inset on the page when there is no footer', async () => {
    await renderScreen(
      <Screen scroll edges={['top', 'bottom']}>
        {body}
      </Screen>,
    );

    expect(flat(safeAreaBox(screen.getByLabelText('body')).props.style).paddingBottom).toBe(
      metrics.insets.bottom,
    );
  });

  it('makes the root a keyboard-avoiding view when `keyboard` is set', async () => {
    await renderScreen(
      <Screen scroll keyboard edges={['top', 'bottom']}>
        {body}
      </Screen>,
    );

    const box = safeAreaBox(screen.getByLabelText('body'));

    // RNTL 14 renders a host-only tree, so `KeyboardAvoidingView` is not itself walkable — the
    // mark it leaves is. It measures its own frame, so the View it wraps the page in carries an
    // `onLayout` that nothing else here would put there.
    expect(typeof (box.parent as Instance).props.onLayout).toBe('function');
    // And it wraps the safe-area box rather than *being* it, which is the whole point: on
    // jest-expo's iOS it runs `behavior="padding"`, composing the keyboard's height over the
    // style it was handed — 0 at rest, so the 34pt inset would vanish from a screen with no
    // footer to own it. Out here that padding lands above the box and the inset survives.
    expect(flat(box.props.style).paddingBottom).toBe(metrics.insets.bottom);
  });

  it('leaves the root a plain View when `keyboard` is not set', async () => {
    // The prop is additive: every screen built before Phase 9A must render exactly as before.
    await renderScreen(
      <Screen scroll edges={['top', 'bottom']}>
        {body}
      </Screen>,
    );

    const box = safeAreaBox(screen.getByLabelText('body'));

    expect(box.props.onLayout).toBeUndefined();
    expect((box.parent as Instance).props.onLayout).toBeUndefined();
    expect(flat(box.props.style).paddingBottom).toBe(metrics.insets.bottom);
  });
});
