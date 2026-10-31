import { render } from '@testing-library/react-native';

import { lightTheme } from '@/theme';
import { Icon, dataGlyph, lineBox } from '@/ui/Icon';
import { LINE_ICON_PATHS } from '@/ui/Icon/lineIcons.generated';

/**
 * The line icons the phone shares with the web (`apps/web/src/ui/lineIcons.ts`), redrawn from the
 * same Untitled UI path data. Pinned here: sizes come off the ramp in `sizes`, never a stray
 * number, the stroke and fill follow the caller, and the generated table holds only real paths.
 */

const svgOf = async (ui: React.ReactElement) => {
  const { toJSON } = await render(ui);
  const tree = toJSON() as {
    props: Record<string, unknown>;
    children: { props: Record<string, unknown> }[];
  };
  return tree;
};

describe('Icon', () => {
  it('draws a ramp size at the theme box', async () => {
    const svg = await svgOf(<Icon name="ChevronRight" size="sm" color="#123456" />);
    expect(svg.props.width).toBe(lightTheme.sizes.iconSm);
    expect(svg.props.height).toBe(lightTheme.sizes.iconSm);
  });

  it('defaults to the size beside body text', async () => {
    expect((await svgOf(<Icon name="Check" color="#000" />)).props.width).toBe(
      lightTheme.sizes.iconSm,
    );
  });

  it('keeps the ramp ordered xs < sm < md < lg', () => {
    const { iconXs, iconSm, iconMd, iconLg } = lightTheme.sizes;
    expect(iconXs).toBeLessThan(iconSm);
    expect(iconSm).toBeLessThan(iconMd);
    expect(iconMd).toBeLessThan(iconLg);
  });

  it('strokes in the caller colour and fills only when asked', async () => {
    // The renderer hands colours to native as processed ints, so compare a path against itself.
    const pathOf = async (filled: boolean) => {
      const tree = JSON.parse(
        JSON.stringify(await svgOf(<Icon name="Bookmark" color="#4733F9" filled={filled} />)),
      );
      return tree.children[0].children[0].props as { stroke: unknown; fill: unknown };
    };
    const outline = await pathOf(false);
    const filled = await pathOf(true);
    expect(outline.stroke).toBeTruthy();
    expect(outline.fill).toBeNull();
    expect(filled.fill).toEqual(outline.stroke);
  });

  it('sizes a caller-derived glyph so the line icon reads as large as the old filled one', () => {
    expect(lineBox(16)).toBe(20);
  });

  it('only holds real path data', () => {
    for (const [name, paths] of Object.entries(LINE_ICON_PATHS)) {
      expect(paths.length).toBeGreaterThan(0);
      for (const d of paths) expect(d).toMatch(/^[Mm]/);
      expect(name).toMatch(/^[A-Z]/);
    }
  });

  it('translates the data layer glyphs and never draws nothing', () => {
    expect(dataGlyph('envelope')).toBe('Mail01');
    expect(dataGlyph('credit-card')).toBe('CreditCard01');
    expect(dataGlyph('not-a-glyph')).toBe('InfoCircle');
  });
});
