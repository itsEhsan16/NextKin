import { render, screen } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Android, deliberately.
 *
 * jest-expo's preset sets `haste.defaultPlatform: 'ios'`, so every other suite in this repo
 * exercises the iOS shadow branch — where `shadows` and `artboardShadows` produce the *same*
 * `boxShadow` string and any assertion below would be vacuous. The bug this defends against
 * exists only on the Android branch, so the branch has to be reached.
 *
 * `buildShadows` reads `Platform.OS` on every call (there is no module-level cache), so mocking
 * the module before import is enough to flip it.
 */
jest.mock('react-native/Libraries/Utilities/Platform', () => {
  const actual = jest.requireActual('react-native/Libraries/Utilities/Platform');
  const base = actual.default ?? actual;
  return { ...base, OS: 'android', __esModule: true, default: { ...base, OS: 'android' } };
});

// eslint-disable-next-line import/first -- must follow the Platform mock above.
import { AtsBadge } from '@/features/resumes/components/AtsBadge';
// eslint-disable-next-line import/first
import { themeFor } from '@/theme';

const flat = (value: unknown) =>
  (StyleSheet.flatten(value as StyleProp<ViewStyle>) ?? {}) as Record<string, unknown>;

/** The badge's own box: the pressable carrying the circular radius. */
const badgeStyle = () => {
  const node = screen.getByLabelText('ATS score 83');
  return flat(node.props.style);
};

/**
 * The ATS chip's missing edge.
 *
 * The chip is a `surfaceCard` disc drawn on a `surfaceCard` thumbnail — white on white — so the
 * only thing that separates it from what it sits on is its shadow. On Android `toShadowStyle`
 * emits a bare `{ elevation: 2 }` and discards the artboard's `0 1 3 rgba(0,0,0,0.08)`, so what
 * actually drew was hwui's penumbra: biased down and outward, and on the grid card it landed on
 * the thumbnail's own border rather than on clean white. The bottom and right arcs fused into that
 * grey line and the disc was reported, twice, as "cropped from right and bottom".
 *
 * Nothing was ever clipping it — `ReactViewGroup.initView()` sets `clipChildren = false` and the
 * only `overflow: 'hidden'` in that subtree belongs to the badge's *sibling*. The disc was fully
 * painted and simply had no edge.
 */
describe('AtsBadge — the disc keeps an edge on Android', () => {
  it('reaches the Android branch, or nothing below has teeth', () => {
    // Guards every assertion in this file, the way carouselSnap guards on scale < 1.
    expect(themeFor('light', 411).shadows.segmentPill).toEqual({ elevation: 2 });
  });

  it('draws the artboard shadow rather than a bare elevation', async () => {
    await render(<AtsBadge score={83} />);

    const style = badgeStyle();
    // The drawn geometry, not a framework curve fitted to one number.
    expect(style.boxShadow).toEqual(expect.stringContaining('rgba(0, 0, 0, 0.08)'));
    // `elevation` alone was the defect: it carries no offset, blur or alpha at all.
    expect(style.elevation).toBeUndefined();
  });

  it('scales that shadow with the device, like every other length', async () => {
    // The artboard blur is 3 at 520; on a 411dp phone it must be 3 × 411/520, not a flat 3.
    const theme = themeFor('light', 411);
    expect(flat(theme.artboardShadows.segmentPill).boxShadow).toBe(
      `0px ${theme.s(1)}px ${theme.s(3)}px rgba(0, 0, 0, 0.08)`,
    );
  });

  it('leaves the shared shadow map alone for everything else', async () => {
    // `shadows` still hands Android `{ elevation }` — cheap, and it owns sibling z-ordering for
    // the chrome. Only a surface painted on its own colour needs the artboard geometry, so this
    // must stay an opt-in rather than becoming the default.
    const theme = themeFor('light', 411);
    expect(theme.shadows.fab).toEqual({ elevation: 10 });
    expect(theme.shadows.card).toEqual({ elevation: 1 });
  });
});
