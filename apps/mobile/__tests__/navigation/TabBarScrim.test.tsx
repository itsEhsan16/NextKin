import { render } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { TabBarScrim } from '@/navigation';
import { layoutScaleFor, tabBarLayoutFor } from '@/theme';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

type ColorStop = { color: string; positions: string[] };
type Gradient = { type: string; direction: string; colorStops: ColorStop[] };
type Node = { props?: Record<string, unknown>; children?: unknown };

/** Flattened style of the one view that carries the gradient. */
async function scrim(): Promise<{ props: Record<string, unknown>; style: Record<string, unknown> }> {
  const tree = (await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <TabBarScrim />
    </SafeAreaProvider>,
  )).toJSON();

  const found: { props: Record<string, unknown>; style: Record<string, unknown> }[] = [];

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const { props, children } = node as Node;
    if (props) {
      const style = Object.assign({}, ...[props.style].flat(Infinity).filter(Boolean)) as Record<
        string,
        unknown
      >;
      if (style.experimental_backgroundImage) found.push({ props, style });
    }
    walk(children);
  };

  walk(tree);
  expect(found).toHaveLength(1);
  return found[0]!;
}



const gradientOf = (style: Record<string, unknown>): Gradient =>
  (style.experimental_backgroundImage as Gradient[])[0]!;

const alphaOf = (stop: ColorStop): number =>
  Number.parseFloat(stop.color.split(',')[3]!.replace(')', ''));

describe('TabBarScrim', () => {
  it('never takes a touch', async () => {
    // Load-bearing and silent when wrong: the scrim spans the full width, so without this every
    // tap and scroll that lands beside the pill dies here instead of reaching the screen.
    expect((await scrim()).props.pointerEvents).toBe('none');
  });

  it('never reaches above the pill', async () => {
    // The complaint that produced this: reaching past the bar washed out the Home shortcut grid
    // while it was still sitting in open space. The veil belongs inside the bar's own band.
    const { style } = await scrim();
    // The pill sizes off `useWindowDimensions`, not the safe-area frame — under jest that is the
    // 750dp viewport, clamped to the artboard. Derive the expectation from the same source or
    // this passes on the wrong number.
    const layout = tabBarLayoutFor(
      layoutScaleFor(Dimensions.get('window').width),
      metrics.insets.bottom,
    );

    expect(style.height as number).toBeLessThan(layout.bottomOffset + layout.pillHeight);
  });

  it('starts the fade at the foot of the pill', async () => {
    // Everything below the bar is covered outright, everything above it is ramp. That split is
    // what makes almost the whole height a gradient rather than a slab with a soft lip.
    const { style } = await scrim();
    const layout = tabBarLayoutFor(
      layoutScaleFor(Dimensions.get('window').width),
      metrics.insets.bottom,
    );
    const height = style.height as number;

    // Stop positions are emitted rounded to 0.1%, which is ~0.1dp of slack at this height.
    const firstFade = Number.parseFloat(gradientOf(style).colorStops[1]!.positions[0]!);
    expect((firstFade / 100) * height).toBeCloseTo(layout.bottomOffset, 0);

    // The ramp is the clear majority of the scrim, not a lip on top of a slab.
    expect(height - layout.bottomOffset).toBeGreaterThan(height * 0.5);
  });

  it('fades to the page colour, not to transparent', async () => {
    // `transparent` is rgba(0,0,0,0), so on the unpremultiplied path the ramp would run through
    // grey on its way out. Every stop has to be the page colour at a falling alpha.
    const stops = gradientOf((await scrim()).style).colorStops;

    for (const stop of stops) expect(stop.color).toMatch(/^rgba\(255, 255, 255, [\d.]+\)$/);
    expect(stops[stops.length - 1]!.color).toBe('rgba(255, 255, 255, 0)');
  });

  it('stays translucent even at its strongest', async () => {
    // The veil fades content out; it does not replace it with a second page. At alpha 1 the
    // band reads as an opaque panel and the sense that there is more to scroll to goes with it.
    const stops = gradientOf((await scrim()).style).colorStops;
    const peak = alphaOf(stops[0]!);

    expect(peak).toBeLessThan(1);
    expect(peak).toBeGreaterThan(0.5);
    // The flat run below the pill and the top of the ramp are the same value, by construction.
    expect(alphaOf(stops[1]!)).toBeCloseTo(peak, 6);
  });

  it('runs the gradient upward from the screen bottom', async () => {
    // 'to top' is angle 0, which puts the first stop at the bottom edge. Any other direction and
    // the opaque end lands under the content instead of under the pill.
    expect(gradientOf((await scrim()).style).direction).toBe('to top');
  });

  it('eases the ramp instead of stepping it', async () => {
    // A straight two-stop ramp bands visibly at this length — the eye reads the derivative breaks
    // at each end as two faint lines. Alphas must fall monotonically and ease at both ends.
    const alphas = gradientOf((await scrim()).style).colorStops.slice(1).map(alphaOf);

    for (let i = 1; i < alphas.length; i += 1) expect(alphas[i]!).toBeLessThan(alphas[i - 1]!);

    // Normalised against the peak so this keeps testing the curve rather than the strength —
    // a linear ramp would put these quarter points at exactly 0.75 and 0.25.
    const eased = alphas.map((a) => a / alphas[0]!);
    expect(eased[1]!).toBeGreaterThan(0.75);
    expect(eased[eased.length - 2]!).toBeLessThan(0.25);
  });
});
