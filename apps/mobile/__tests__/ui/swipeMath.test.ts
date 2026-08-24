import { clampSwipe, resolveSwipeSnap, SWIPE_ACTION_WIDTH } from '@/ui/SwipeableRow';

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

  it('a rightward flick closes from anywhere', () => {
    expect(resolveSwipeSnap(-ROW * 0.7, 400, ACTIONS, ROW)).toBe('closed');
  });
});
