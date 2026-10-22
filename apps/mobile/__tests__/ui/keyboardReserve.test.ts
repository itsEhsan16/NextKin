import { keyboardBottomReserve } from '@/ui/Screen/keyboardReserve';

const INSET = 34;

describe('keyboardBottomReserve', () => {
  it("lets the keys cover a footer's own inset strip, so its buttons sit just above them", () => {
    expect(
      keyboardBottomReserve({
        hasFooter: true,
        edges: ['top'],
        tabBarInset: false,
        insetBottom: INSET,
      }),
    ).toBe(INSET);
  });

  it('covers the page inset on a screen with a bottom edge and no footer', () => {
    expect(
      keyboardBottomReserve({
        hasFooter: false,
        edges: ['top', 'bottom'],
        tabBarInset: false,
        insetBottom: INSET,
      }),
    ).toBe(INSET);
  });

  it('reserves nothing where nothing pads the inset (the Jobs list, under the tab bar)', () => {
    expect(
      keyboardBottomReserve({
        hasFooter: false,
        edges: ['top'],
        tabBarInset: false,
        insetBottom: INSET,
      }),
    ).toBe(0);
    expect(
      keyboardBottomReserve({
        hasFooter: false,
        edges: ['top', 'bottom'],
        tabBarInset: true,
        insetBottom: INSET,
      }),
    ).toBe(0);
  });
});
