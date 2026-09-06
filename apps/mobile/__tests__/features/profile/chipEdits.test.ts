import {
  addChip,
  atCap,
  capNote,
  countCapped,
  countOf,
  filterSuggestions,
  listsEqual,
  removeChip,
} from '@/features/profile/chipEdits';

const SKILLS = ['Figma', 'Design systems', 'Prototyping'];

describe('chipEdits (V2 §7.3 — the rules behind the profile chip lists)', () => {
  describe('addChip', () => {
    it('appends the trimmed entry', () => {
      expect(addChip(SKILLS, '  Accessibility  ', 'skill')).toEqual({
        items: [...SKILLS, 'Accessibility'],
      });
    });

    it('collapses inner whitespace so one skill cannot be typed as two', () => {
      expect(addChip([], 'Design   tokens', 'skill')).toEqual({ items: ['Design tokens'] });
    });

    it('refuses a blank entry by name rather than doing nothing', () => {
      expect(addChip(SKILLS, '   ', 'desired role')).toEqual({
        refused: 'Type a desired role first.',
      });
    });

    it('refuses a duplicate whatever case it is typed in, and points at the one on the list', () => {
      expect(addChip(SKILLS, ' design SYSTEMS ', 'skill')).toEqual({
        refused: 'Design systems is already on your list.',
      });
    });

    it('leaves the list alone when it refuses', () => {
      const before = [...SKILLS];
      addChip(SKILLS, 'figma', 'skill');
      expect(SKILLS).toEqual(before);
    });

    it('refuses once the cap is reached, with the cap as the reason', () => {
      const five = ['a', 'b', 'c', 'd', 'e'];
      expect(addChip(five, 'f', 'desired role', 5)).toEqual({
        refused: '5 of 5 — remove one to add another',
      });
      // One under the cap still goes in.
      expect(addChip(five.slice(0, 4), 'e', 'desired role', 5)).toEqual({ items: five });
    });
  });

  describe('the cap', () => {
    it('is only reached when a max is set', () => {
      expect(atCap(['a', 'b'], undefined)).toBe(false);
      expect(atCap(['a', 'b'], 5)).toBe(false);
      expect(atCap(['a', 'b', 'c', 'd', 'e'], 5)).toBe(true);
    });

    it('words itself the same as the helper under the field', () => {
      expect(capNote(5)).toBe('5 of 5 — remove one to add another');
    });
  });

  it('removes by exact value and leaves the rest in order', () => {
    expect(removeChip(SKILLS, 'Design systems')).toEqual(['Figma', 'Prototyping']);
    expect(removeChip(SKILLS, 'design systems')).toEqual(SKILLS);
  });

  it('treats a reorder as a change', () => {
    expect(listsEqual(SKILLS, [...SKILLS])).toBe(true);
    expect(listsEqual(SKILLS, ['Design systems', 'Figma', 'Prototyping'])).toBe(false);
    expect(listsEqual(SKILLS, SKILLS.slice(0, 2))).toBe(false);
  });

  it('counts either way the two screens ask for', () => {
    expect(countOf(12, 'skill')).toBe('12 skills');
    expect(countOf(1, 'location')).toBe('1 location');
    expect(countCapped(3, 5)).toBe('3 of 5');
  });

  describe('filterSuggestions', () => {
    const pool = ['Figma', 'Design systems', 'Design tokens', 'Prototyping', 'User research'];

    it('never offers what is already on the list', () => {
      expect(filterSuggestions(pool, ['figma', 'Prototyping'], '')).toEqual([
        'Design systems',
        'Design tokens',
        'User research',
      ]);
    });

    it('narrows on what has been typed, ignoring case and surrounding space', () => {
      expect(filterSuggestions(pool, [], '  DESIGN ')).toEqual(['Design systems', 'Design tokens']);
    });

    it('stops at the limit it is given', () => {
      expect(filterSuggestions(pool, [], '', 2)).toEqual(['Figma', 'Design systems']);
    });
  });
});
