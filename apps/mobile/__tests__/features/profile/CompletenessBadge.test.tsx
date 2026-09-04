import { cleanup, render, screen } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { profileFixture, userFixture } from '@/data/mock/fixtures';
import { ProfileIdentity } from '@/features/profile/components/ProfileIdentity';
import { themeFor } from '@/theme';

/**
 * The badge that grows for its one long label.
 *
 * `typeRamp.test.ts` proves the two widths are the right numbers; this proves the component still
 * chooses between them. The rule lives in one expression — a label longer than three characters
 * gets the widened pill — and deleting it puts "100%" back through the border with every
 * arithmetic assertion still green.
 */
const flat = (value: unknown): Record<string, unknown> =>
  (StyleSheet.flatten(value as StyleProp<ViewStyle>) ?? {}) as Record<string, unknown>;

/**
 * Structural, like `testSupport/scroller.ts`: RTL's host elements are not test-renderer
 * instances, so they carry `children` but no `findAll`, and `react-test-renderer`'s types are
 * not installed. Describing the shape is cheaper than either dependency.
 */
type Walkable = { props: { style?: unknown }; children: readonly (Walkable | string)[] };

const descendants = (node: Walkable, out: Walkable[] = []): Walkable[] => {
  out.push(node);
  for (const child of node.children) if (typeof child !== 'string') descendants(child, out);
  return out;
};

/**
 * The pill is the only absolutely-positioned box under the ring drawn with a border. The other
 * one is the 104-square SVG the arc lives on, which flattens to `borderWidth: 0` rather than to
 * no border at all — hence the `> 0` and not just a `typeof`.
 */
const badgeWidth = (percent: string): number => {
  const ring = screen.getByLabelText(`Profile ${percent} complete`) as unknown as Walkable;
  const boxes = descendants(ring)
    .map((node) => flat(node.props.style))
    .filter((style) => {
      const border = style.borderWidth;
      return (
        style.position === 'absolute' &&
        typeof style.width === 'number' &&
        typeof border === 'number' &&
        border > 0
      );
    })
    .map((style) => style.width as number);
  expect(boxes).toHaveLength(1);
  return boxes[0]!;
};

const mount = (completeness: number) =>
  render(
    <ProfileIdentity
      user={userFixture}
      profile={{ ...profileFixture, completeness }}
      onEdit={jest.fn()}
    />,
  );

describe('profile completeness badge', () => {
  afterEach(cleanup);

  // Jest's viewport clamps to the 520 board, so `s()` is the identity and these are the tokens.
  const theme = themeFor('light', 750);

  it('renders every value the board drew at exactly the width it drew', async () => {
    for (const completeness of [0, 0.07, 0.72, 0.86, 0.99]) {
      await mount(completeness);
      expect(badgeWidth(`${Math.round(completeness * 100)}%`)).toBe(theme.s(44));
      await cleanup();
    }
  });

  it('widens for the one label the board never drew', async () => {
    // Two `completeNextStep` calls from the fixture's 0.72 land here; see profileRepo.
    await mount(1);
    expect(badgeWidth('100%')).toBeCloseTo(theme.s(53.28), 5);
  });
});
