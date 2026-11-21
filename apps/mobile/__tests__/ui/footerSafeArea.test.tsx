import { cleanup, render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { OnboardingFrame } from '@/features/create/components/OnboardingFrame';
import { themeFor } from '@/theme';
import { FlowFooter } from '@/ui/kit';

/**
 * Footers on Android phones with a navigation bar. `Screen` stops padding its root once it has a
 * footer, so the footer must add the bottom inset itself: without it, the main button of every
 * create flow and run view sat under the 3-button bar (about 48dp) or the gesture handle.
 */
const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  // A 3-button navigation bar.
  insets: { top: 32, left: 0, right: 0, bottom: 48 },
};

const theme = themeFor('light', Dimensions.get('window').width);
const flat = (value: unknown) =>
  (StyleSheet.flatten(value as StyleProp<ViewStyle>) ?? {}) as Record<string, unknown>;

/** The bottom padding of the nearest ancestor that sets one. */
const bottomPadAbove = (label: string): number => {
  for (let n = screen.getByLabelText(label).parent; n; n = n.parent) {
    const pad = flat(n.props.style).paddingBottom;
    if (typeof pad === 'number' && pad > 0) return pad;
  }
  throw new Error(`no padded ancestor above ${label}`);
};

const wrap = (node: React.ReactNode) =>
  render(<SafeAreaProvider initialMetrics={metrics}>{node}</SafeAreaProvider>);

describe('footers clear the navigation bar', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('an inset FlowFooter pads the bottom inset', async () => {
    await wrap(<FlowFooter inset primary={{ label: 'Continue', onPress: () => {} }} />);
    expect(bottomPadAbove('Continue')).toBe(theme.u(8) + 48);
  });

  it("OnboardingFrame's footer pads the bottom inset", async () => {
    await wrap(
      <OnboardingFrame
        step={1}
        total={3}
        title="Pick a resume"
        footer={<FlowFooter primary={{ label: 'Next step', onPress: () => {} }} />}
      >
        <Text>Body</Text>
      </OnboardingFrame>,
    );
    expect(bottomPadAbove('Next step')).toBe(theme.u(8) + 48);
  });
});
