import { closeDuration } from '@/ui/Sheet/sheetDismissMath';

const RANGE = { min: 120, max: 200 };

describe('closeDuration', () => {
  it('takes the full close time from fully open (the close button, the scrim)', () => {
    expect(closeDuration(1, RANGE)).toBe(200);
  });

  it('takes only the share the remaining distance needs after a partial drag', () => {
    expect(closeDuration(0.7, RANGE)).toBe(140);
  });

  it('never drops below the floor, so the last stretch still reads as motion', () => {
    expect(closeDuration(0.2, RANGE)).toBe(120);
    expect(closeDuration(0, RANGE)).toBe(120);
  });

  it('clamps an overshooting spring to the full time', () => {
    expect(closeDuration(1.02, RANGE)).toBe(200);
  });
});
