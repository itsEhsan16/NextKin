import { revealTarget } from '@/ui/Screen';

/**
 * The arithmetic behind "why can't I see what I'm typing".
 *
 * `Screen keyboard` buys iOS padding and Android's window resize. Both make a focused field
 * *reachable*; neither moves the scroll offset, and React Native's `ScrollView` does not scroll to
 * a focused `TextInput` on Android at all. So a field below the fold stayed under the keyboard.
 * A device pass found it on `/profile/edit`, whose last node is the numeric "Years of experience".
 *
 * These are the numbers of a 390×844 phone: a 291pt-tall keyboard puts its top edge at 553, and a
 * form's pinned Save bar is about 90 tall on top of that.
 */

const KEYBOARD_TOP = 553;
const FOOTER = 90;
const base = { keyboardTop: KEYBOARD_TOP, footerHeight: FOOTER, scrollOffset: 0 };

describe('revealTarget', () => {
  it('leaves a field that is already clear of the keyboard alone', () => {
    // A field near the top of the page: moving it would yank the page while someone tabs a form.
    expect(revealTarget({ ...base, fieldY: 120, fieldHeight: 76 })).toBeNull();
  });

  it('leaves a field alone when it ends exactly on the margin', () => {
    // visibleBottom = 553 − 90 − 12 = 451. A field ending there is visible, not hidden.
    expect(revealTarget({ ...base, fieldY: 375, fieldHeight: 76 })).toBeNull();
  });

  it('scrolls a hidden field up by exactly how much of it is covered', () => {
    // Ends at 600; 149 of it sits under the bar and the keyboard.
    expect(revealTarget({ ...base, fieldY: 524, fieldHeight: 76 })).toBe(149);
  });

  it('adds the delta to where the scroller already is, rather than jumping to it', () => {
    // The same field, on a page already scrolled 300 down.
    expect(revealTarget({ ...base, fieldY: 524, fieldHeight: 76, scrollOffset: 300 })).toBe(449);
  });

  it('counts the pinned bar as well as the keyboard', () => {
    // Same geometry with no footer: 90pt less is hidden, so 90pt less scrolling.
    expect(revealTarget({ ...base, fieldY: 524, fieldHeight: 76, footerHeight: 0 })).toBe(59);
  });

  it('reveals the whole field, label and helper row included, not just its box', () => {
    // A tall field — label + input + helper — must clear entirely, so its height is what counts.
    const short = revealTarget({ ...base, fieldY: 430, fieldHeight: 52 });
    const tall = revealTarget({ ...base, fieldY: 430, fieldHeight: 110 });
    expect(short).toBe(31);
    expect(tall).toBe(89);
  });

  it('never asks the scroller for a negative offset', () => {
    // A field measured above the window (mid-transition) must not bounce the page past its top.
    expect(revealTarget({ ...base, fieldY: -400, fieldHeight: 76, scrollOffset: 0 })).toBeNull();
    expect(revealTarget({ ...base, fieldY: 524, fieldHeight: 76, scrollOffset: -500 })).toBe(0);
  });

  it('does nothing while the keyboard is down', () => {
    // The provider passes the window height as the keyboard top when there are no metrics yet.
    expect(revealTarget({ ...base, keyboardTop: 844, fieldY: 600, fieldHeight: 76 })).toBeNull();
  });
});
