import { countWord, quickWinsNote } from '@/features/resumes/editorSections';

describe('the editor hero note (RESUMES 06 577:6974)', () => {
  it('spells a small count the way the boards do, and falls back to digits', () => {
    expect(countWord(4)).toBe('Four');
    expect(countWord(1)).toBe('One');
    expect(countWord(12)).toBe('12');
  });

  it('reads the board copy for a strong document', () => {
    expect(quickWinsNote(4, true)).toBe('Four quick wins left before it is airtight.');
    expect(quickWinsNote(1, true)).toBe('One quick win left before it is airtight.');
  });

  it('never promises "airtight" below the strong band', () => {
    expect(quickWinsNote(3, false)).toBe('Three quick wins can lift this score.');
  });

  it('says so when nothing is left', () => {
    expect(quickWinsNote(0, true)).toBe('No quick wins left on this one.');
  });
});
