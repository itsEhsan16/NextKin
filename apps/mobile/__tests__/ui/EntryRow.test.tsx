import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';

import { EntryRow, type EntryRowProps } from '@/ui/EntryRow';

/**
 * The primitive that replaced `ListRow` on the four career-profile lists after a device pass found
 * their titles rendering at zero width.
 *
 * `ListRow`'s `value` is a *trailing* value — "4 roles", "System", "₹24L". Given a subtitle
 * instead, Yoga starved the label: `flex: 1` gives it `flexBasis: 0`, and `flexShrink` defaults to
 * 0 (the web defaults it to 1), so a long value could not shrink and the label had no basis to
 * shrink from. The education degree rendered no glyphs at all.
 *
 * Jest performs no layout, so the fix is pinned structurally rather than in pixels: the two lines
 * are separate, stacked `Text` nodes in one `flex: 1` column, so neither can take the other's
 * width at any device size. What is asserted here is everything above that — the tag cap and the
 * single-focus-stop reading.
 */

const onPress = jest.fn();
const shown = { includeHiddenElements: true } as const;

const renderRow = (props: Partial<EntryRowProps> = {}) =>
  render(
    <EntryRow
      icon="Briefcase01"
      title="Senior UX Designer"
      meta="Flipkart · Mar 2022 – Present"
      onPress={onPress}
      {...props}
    />,
  );

describe('EntryRow', () => {
  beforeEach(() => {
    onPress.mockClear();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('draws the title and the meta line as two separate nodes', async () => {
    await renderRow();

    // Separate nodes is the whole fix: one Text cannot starve another it is not competing with.
    expect(screen.getByText('Senior UX Designer')).toBeOnTheScreen();
    expect(screen.getByText('Flipkart · Mar 2022 – Present')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Senior UX Designer, Flipkart · Mar 2022 – Present'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('holds a title on its own when there is no meta line', async () => {
    await renderRow({ meta: undefined });

    expect(screen.getByLabelText('Senior UX Designer')).toBeOnTheScreen();
  });

  it('caps the tags and counts the rest into one overflow chip', async () => {
    await renderRow({
      tags: ['Design systems', 'Figma', 'Mobile UX', 'Prototyping', 'A/B testing'],
    });

    expect(screen.getByText('Design systems', shown)).toBeOnTheScreen();
    expect(screen.getByText('Mobile UX', shown)).toBeOnTheScreen();
    // Three shown, two folded away — a row cannot grow without bound as skills are added.
    expect(screen.queryByText('Prototyping', shown)).toBeNull();
    expect(screen.getByText('+2', shown)).toBeOnTheScreen();
  });

  it('draws no overflow chip when the tags fit', async () => {
    await renderRow({ tags: ['Design systems', 'Figma'] });

    expect(screen.getByText('Figma', shown)).toBeOnTheScreen();
    expect(screen.queryByText(/^\+\d+$/, shown)).toBeNull();
  });

  it('reads the whole row as one stop, tags included', async () => {
    await renderRow({ tags: ['Design systems', 'Figma', 'Mobile UX', 'Prototyping'] });

    // Every tag is named — including the ones folded into "+1", which a reader would otherwise
    // have no way to hear — while the chips themselves stay out of the tree so passing one entry
    // is one swipe rather than five.
    expect(
      screen.getByLabelText(
        'Senior UX Designer, Flipkart · Mar 2022 – Present, Design systems, Figma, Mobile UX, Prototyping',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Design systems')).toBeNull();
  });

  it('lets a caller override the reading without touching what is drawn', async () => {
    await renderRow({ accessibilityLabel: 'Role, Senior UX Designer at Flipkart' });

    expect(screen.getByLabelText('Role, Senior UX Designer at Flipkart')).toBeOnTheScreen();
    expect(screen.getByText('Flipkart · Mar 2022 – Present')).toBeOnTheScreen();
  });
});
