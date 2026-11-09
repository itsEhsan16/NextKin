import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { Screen } from '@/ui/Screen';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const paddingTopsAbove = (node: ReturnType<typeof screen.getByText>) => {
  const pads: number[] = [];
  let at = node.parent;
  while (at) {
    const top = StyleSheet.flatten(at.props.style)?.paddingTop;
    if (typeof top === 'number' && top > 0) pads.push(top);
    at = at.parent;
  }
  return pads;
};

/** §199: a page whose wash should reach the top of the glass, not stop under the status bar. */
describe('Screen bleedTop', () => {
  it('runs the scroll page behind the status bar and keeps the inset inside the content', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <Screen scroll bleedTop padded={false}>
          <Text>Top of the page</Text>
        </Screen>
      </SafeAreaProvider>,
    );
    // No box pads the page down by the inset: the scroller starts at the very top.
    expect(paddingTopsAbove(screen.getByText('Top of the page'))).not.toContain(47);
  });

  it('pads below the status bar as before without it', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <Screen scroll padded={false}>
          <Text>Top of the page</Text>
        </Screen>
      </SafeAreaProvider>,
    );
    expect(paddingTopsAbove(screen.getByText('Top of the page'))).toContain(47);
  });
});
