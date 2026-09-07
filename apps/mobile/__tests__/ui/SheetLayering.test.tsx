import { cleanup, render, screen } from '@testing-library/react-native';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { zIndex } from '@/theme';
import { Sheet } from '@/ui/Sheet';
import { StickyActionBar } from '@/ui/StickyActionBar';

/**
 * A sheet must paint over a page's pinned bar.
 *
 * `zIndex.sheet` was defined in the tokens and never applied, so the overlay sat at an implicit 0
 * while `StickyActionBar` declares 10 — and an explicit z-index beats document order however late
 * the sheet renders. Every sheet raised over a form was therefore painted UNDER that form's bar:
 * on the profile date pickers the page's "Save" covered the bottom of the sheet's own "Done", and
 * the scrim did not dim it. Found on a device, invisible to every other test in this suite.
 */

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** The tokens say what the order is; these assertions say the components obey it. */
const flatten = (style: unknown): Record<string, unknown> =>
  (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;

describe('overlay layering', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('orders the tokens so a sheet is above a pinned bar and a toast above both', () => {
    expect(zIndex.sheet).toBeGreaterThan(zIndex.stickyBar);
    expect(zIndex.sheet).toBeGreaterThan(zIndex.fab);
    expect(zIndex.sheet).toBeGreaterThan(zIndex.tabBar);
    expect(zIndex.toast).toBeGreaterThan(zIndex.sheet);
  });

  it('puts a sheet over the bar of the page it was raised from', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <View>
          <StickyActionBar primary={{ label: 'Save', onPress: () => {} }} />
          <Sheet open onClose={() => {}} height={400} accessibilityLabel="When did you leave?">
            <Text>Done</Text>
          </Sheet>
        </View>
      </SafeAreaProvider>,
    );

    // Hidden elements included: the sheet marks itself modal, which takes the page's own controls
    // out of the accessibility tree — correctly, and that is not what is under test here.
    const shown = { includeHiddenElements: true } as const;
    const sheetLayer = flatten(
      screen.getByLabelText('When did you leave?', shown).parent?.props.style,
    );
    const barLayer = flatten(screen.getByLabelText('Save', shown).parent?.parent?.props.style);

    // Both must be numbers: an undefined z-index on the sheet is exactly the bug.
    expect(typeof sheetLayer.zIndex).toBe('number');
    expect(sheetLayer.zIndex).toBeGreaterThan(barLayer.zIndex as number);
  });
});

/**
 * The OS draws the keyboard above everything in the React tree, so no z-index can rescue a sheet
 * raised while a field still has focus. Tapping a date row straight from a focused "Job title"
 * opened both, and the sheet was buried.
 */
describe('a sheet and the keyboard', () => {
  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  const renderWith = async (props: { avoidKeyboard?: boolean }) =>
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <Sheet open onClose={() => {}} height={400} accessibilityLabel="Picker" {...props}>
          <Text>Done</Text>
        </Sheet>
      </SafeAreaProvider>,
    );

  it('takes the keyboard down when it has no field of its own', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    await renderWith({});
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('leaves the keyboard alone for a sheet that carries a field', async () => {
    // The rename pane and the location sheet raise their own keyboard; dismissing here would
    // fight their autofocus.
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    await renderWith({ avoidKeyboard: true });
    expect(dismiss).not.toHaveBeenCalled();
  });
});
