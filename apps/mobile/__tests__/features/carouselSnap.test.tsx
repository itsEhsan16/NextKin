import { render } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { Job } from '@/data/models';
import { TopJobMatches } from '@/features/home/components/TopJobMatches';
import { TodaysPicks } from '@/features/jobs/components/TodaysPicks';
import { layoutScaleFor } from '@/theme';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Two rows is enough — the defect is in the interval, which a single gap already exposes. */
const jobs = [1, 2].map(
  (n) =>
    ({
      id: `job-${n}`,
      title: `Senior Product Designer ${n}`,
      company: 'Stripe',
      location: 'Bengaluru',
      workMode: 'remote',
      employmentType: 'full_time',
      postedAt: '2026-01-01T00:00:00.000Z',
      matchScore: 90,
      isSaved: false,
    }) as unknown as Job,
);

type Node = { props?: Record<string, unknown>; children?: unknown };

/** The horizontal list's own style and contentContainerStyle, flattened. */
function listStyles(tree: unknown): { style: Record<string, unknown>; content: Record<string, unknown> } {
  let found: { style: Record<string, unknown>; content: Record<string, unknown> } | undefined;
  const flat = (v: unknown) =>
    Object.assign({}, ...[v].flat(Infinity).filter(Boolean)) as Record<string, unknown>;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const { props, children } = node as Node;
    if (props && typeof props.snapToInterval === 'number') {
      found = { style: flat(props.style), content: flat(props.contentContainerStyle) };
    }
    walk(children);
  };
  walk(tree);
  expect(found).toBeDefined();
  return found!;
}

/** The `snapToInterval` the horizontal list was actually handed. */
function snapInterval(tree: unknown): number {
  let snap: number | undefined;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const { props, children } = node as Node;
    if (props && typeof props.snapToInterval === 'number') snap = props.snapToInterval;
    walk(children);
  };
  walk(tree);
  expect(snap).toBeDefined();
  return snap!;
}

const renderIn = async (node: React.ReactElement) =>
  (await render(<SafeAreaProvider initialMetrics={metrics}>{node}</SafeAreaProvider>)).toJSON();

/**
 * The jest viewport is 750dp, which `themeFor` clamps to the 520 artboard — so scale is 1 and
 * `s(16) === 16`. At that width a raw artboard constant and its scaled form are the SAME NUMBER,
 * which is precisely why this defect shipped: no test at the default viewport can see it. Pin the
 * window to a real phone so the two spaces actually differ.
 */
const PHONE = 390;

const noop = () => {};

/**
 * A carousel must snap by exactly one card plus one gap, both in device space.
 *
 * This drifted because the two halves of that sum live apart: the separator was scaled with the
 * device while the interval kept the raw 520-space constant. At 390 that puts the snap point 4dp
 * past the real pitch, and the error compounds per card until the list rests mid-card and clips
 * the title — which is how it was found, in a screenshot reading "uct Designer".
 *
 * The card sizes off `useWindowDimensions`, not the safe-area frame, so the expectation is built
 * from the same scale the component sees.
 */
describe('horizontal carousels snap to a whole card', () => {
  const { s } = layoutScaleFor(PHONE);

  beforeAll(() => {
    jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({ width: PHONE, height: 844, scale: 3, fontScale: 1 });
  });

  afterAll(() => jest.restoreAllMocks());

  it('renders at a width where the two unit spaces differ', () => {
    // Guards every assertion below: they only have teeth while scale < 1.
    expect(s(16)).toBeLessThan(16);
  });

  it('Today’s picks snaps by a scaled card plus a scaled gap', async () => {
    const tree = await renderIn(
      <TodaysPicks
        picks={jobs}
        status="success"
        onPressJob={noop}
        onToggleSave={noop}
        onRetry={noop}
      />,
    );
    // Figma 1:299 — 300pt card, 16pt gap, both artboard values.
    expect(snapInterval(tree)).toBeCloseTo(s(300) + s(16), 6);
  });

  it('Top job matches snaps by a scaled card plus a scaled gap', async () => {
    const tree = await renderIn(
      <TopJobMatches
        jobs={jobs}
        status="success"
        onViewAll={noop}
        onPressJob={noop}
        onRetry={noop}
      />,
    );
    // Figma 1:100 — 288pt card, 16pt gap.
    expect(snapInterval(tree)).toBeCloseTo(s(288) + s(16), 6);
  });

  it.each([
    ['Today’s picks', () => (
      <TodaysPicks picks={jobs} status="success" onPressJob={noop} onToggleSave={noop} onRetry={noop} />
    )],
    ['Top job matches', () => (
      <TopJobMatches jobs={jobs} status="success" onViewAll={noop} onPressJob={noop} onRetry={noop} />
    )],
  ])('%s runs full-bleed but still starts at the gutter', async (_name, build) => {
    // Boxed inside the page gutter, a half-scrolled card is sliced at the gutter line with dead
    // margin beside it. Breaking out and paying the gutter back as content padding keeps the
    // first card aligned with the heading while letting the rest run off the real screen edge.
    // The two must cancel exactly — if they drift apart the row stops lining up with its title.
    const { style, content } = listStyles(await renderIn(build()));
    const bleed = style.marginHorizontal as number;
    const pad = content.paddingHorizontal as number;

    expect(bleed).toBeLessThan(0);
    expect(pad).toBe(-bleed);
    expect(pad).toBeCloseTo(s(24), 6); // spacing.gutter
  });

  it('would have caught the raw-gap form', async () => {
    // The shipped defect was `s(card) + GAP`. State the wrong answer explicitly so the test says
    // what it is defending against, not just what it wants.
    expect(s(300) + s(16)).not.toBeCloseTo(s(300) + 16, 6);
    expect(s(300) + 16 - (s(300) + s(16))).toBeCloseTo(4, 6);
  });
});
