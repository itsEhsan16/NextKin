import {
  claimSwipeRow,
  clampSwipe,
  closeOpenSwipeRow,
  releaseSwipeRow,
  resolveSwipeSnap,
  SWIPE_ACTION_WIDTH,
} from '@/ui/SwipeableRow';

const ROW = 390;
const ACTIONS = 2 * SWIPE_ACTION_WIDTH; // 168

describe('SwipeableRow geometry (NOTIF 02, note 1:2600)', () => {
  it('only ever moves left', () => {
    expect(clampSwipe(50, ROW)).toBe(0);
    expect(clampSwipe(-50, ROW)).toBe(-50);
    expect(clampSwipe(-9999, ROW)).toBe(-ROW);
  });

  it('a short swipe rests on the action panels', () => {
    expect(resolveSwipeSnap(-ACTIONS / 2 - 1, 0, ACTIONS, ROW)).toBe('open');
    expect(resolveSwipeSnap(-ACTIONS, 0, ACTIONS, ROW)).toBe('open');
  });

  it('a timid swipe closes again', () => {
    expect(resolveSwipeSnap(-30, 0, ACTIONS, ROW)).toBe('closed');
  });

  it('a full swipe commits the primary action', () => {
    expect(resolveSwipeSnap(-ROW * 0.6, 0, ACTIONS, ROW)).toBe('commit');
  });

  it('a decisive leftward flick opens without the distance', () => {
    expect(resolveSwipeSnap(-40, -500, ACTIONS, ROW)).toBe('open');
  });

  it('a row with nothing to commit rests open after a full swipe', () => {
    expect(resolveSwipeSnap(-ROW * 0.6, 0, ACTIONS, ROW, false)).toBe('open');
  });

  it('a rightward flick closes from anywhere', () => {
    expect(resolveSwipeSnap(-ROW * 0.7, 400, ACTIONS, ROW)).toBe('closed');
  });
});

describe('one open swipe row at a time', () => {
  const row = () => ({ close: jest.fn() });

  it('opening a row closes the one open before it', () => {
    const first = row();
    const second = row();
    claimSwipeRow(first);
    claimSwipeRow(second);
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(second.close).not.toHaveBeenCalled();
    closeOpenSwipeRow();
  });

  it('re-claiming the open row does not close it', () => {
    const only = row();
    claimSwipeRow(only);
    claimSwipeRow(only);
    expect(only.close).not.toHaveBeenCalled();
    closeOpenSwipeRow();
  });

  it('scrolling closes the open row, and a released row is left alone', () => {
    const open = row();
    claimSwipeRow(open);
    closeOpenSwipeRow();
    expect(open.close).toHaveBeenCalledTimes(1);

    const released = row();
    claimSwipeRow(released);
    releaseSwipeRow(released);
    closeOpenSwipeRow();
    expect(released.close).not.toHaveBeenCalled();
  });
});
