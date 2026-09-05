import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { themeFor } from '@/theme';
import { StickyActionBar, type StickyActionBarProps } from '@/ui/StickyActionBar';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** The jest window is 750, clamped to the artboard — so scale is 1 and tokens are raw. */
const theme = themeFor('light', Dimensions.get('window').width);

/** `react-test-renderer` types are not installed, so the instance type comes off a query. */
type Instance = ReturnType<typeof screen.getByLabelText>;

const flat = (value: unknown): Record<string, unknown> =>
  (StyleSheet.flatten(value as StyleProp<ViewStyle>) ?? {}) as Record<string, unknown>;

const renderBar = async (props: StickyActionBarProps) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <StickyActionBar {...props} />
    </SafeAreaProvider>,
  );

/** The bar itself: the nearest ancestor of a button that draws the hairline top border. */
const barAbove = (node: Instance): Instance => {
  for (let n = node.parent; n; n = n.parent) {
    if (flat(n.props.style).borderTopWidth != null) return n;
  }
  throw new Error('expected a bar with a top border above this node');
};

describe('StickyActionBar', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('presses the primary action', async () => {
    const onPress = jest.fn();
    await renderBar({ primary: { label: 'Apply now', onPress } });

    const cta = screen.getByRole('button', { name: 'Apply now' });
    fireEvent.press(cta);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders one button when no secondary is passed', async () => {
    await renderBar({ primary: { label: 'Apply now' } });

    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('puts a fixed-width ghost secondary before the primary', async () => {
    // Save keeps the width it has on Job Detail whatever the primary is doing, so it is
    // basis-sized with no grow or shrink and the primary flexes into the rest of the row.
    await renderBar({ primary: { label: 'Apply now' }, secondary: { label: 'Save' } });

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.props.accessibilityLabel)).toEqual(['Save', 'Apply now']);
    expect(flat(buttons[0]?.props.style)).toMatchObject({
      flexBasis: theme.s(140),
      flexGrow: 0,
      flexShrink: 0,
      backgroundColor: 'transparent',
    });
    expect(flat(buttons[1]?.props.style).flex).toBe(1);
  });

  it('announces the note politely', async () => {
    await renderBar({ primary: { label: 'Generate' }, note: '2 generations left this month' });

    const note = screen.getByText('2 generations left this month');
    expect(note.props.accessibilityLiveRegion).toBe('polite');
  });

  it('carries the bottom inset itself and hairlines its top edge', async () => {
    // Nothing above the bar pads for the home indicator once it is a `Screen` footer, so the
    // padding it adds here is the only thing keeping the buttons off it.
    await renderBar({ primary: { label: 'Apply now' } });

    const bar = flat(barAbove(screen.getByRole('button', { name: 'Apply now' })).props.style);
    expect(bar.paddingBottom).toBe(theme.spacing[4] + metrics.insets.bottom);
    expect(bar.borderTopWidth).toBe(StyleSheet.hairlineWidth);
  });

  it('keeps the label and marks the primary busy while loading', async () => {
    // The label is gone from the screen — an ActivityIndicator has replaced it — so the
    // accessibility label is all a screen reader has left to name the control with.
    await renderBar({ primary: { label: 'Generating', loading: true } });

    const cta = screen.getByLabelText('Generating');
    expect(cta).toBeBusy();
    expect(cta).toBeDisabled();
  });
});
