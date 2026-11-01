import { savedNotice } from '@/features/resumes/hooks/useDocumentExport';

const clean = { sections: { found: 5, total: 5 }, bullets: { found: 23, total: 23 } };

describe('what the toast says after a download (toreview §146.6)', () => {
  it('says what read back from the file', () => {
    expect(savedNotice('pdf', clean)).toEqual({
      text: 'Saved as PDF. We read it back: 5 of 5 sections, 23 of 23 bullets.',
      tone: 'success',
    });
  });

  it('says so when a line didn’t, without calling it a failure', () => {
    const short = { ...clean, bullets: { found: 21, total: 23 } };
    expect(savedNotice('pdf', short)).toEqual({
      text: 'Saved as PDF. Only 21 of 23 bullets read back. Open the file and check it.',
      tone: 'info',
    });
  });

  it('claims nothing without a read-back', () => {
    expect(savedNotice('pdf', undefined)).toEqual({ text: 'Saved as PDF', tone: 'success' });
  });
});
