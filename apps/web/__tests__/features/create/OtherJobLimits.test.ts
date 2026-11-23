import { otherJobInput } from '@/features/create/jobFlow/OtherJobBox';
import { MAX_JD_CHARS } from '@/features/upload/uploadLibrary';

/** A pasted description is never cut short, and one the server would refuse never goes (owner, 2026-11-23). */
describe('the pasted job description', () => {
  const line = 'Evaluate defect severity and business impact. ';

  it('takes the server’s whole limit, not half of it', () => {
    expect(MAX_JD_CHARS).toBe(20_000);
    const text = line.repeat(Math.floor(19_000 / line.length));
    expect(otherJobInput({ text, file: null })).toEqual({ input: { source: 'paste', text } });
  });

  it('says how long an over-long paste is and what to remove, instead of sending it', () => {
    const text = line.repeat(Math.ceil(20_500 / line.length));
    const read = otherJobInput({ text, file: null });
    expect(read).toMatchObject({
      problem: expect.stringMatching(
        /characters; up to 20,000 fit\. Remove the company introduction/,
      ),
    });
  });

  it('says a paste is too short to be a description', () => {
    expect(otherJobInput({ text: 'QA lead', file: null })).toMatchObject({
      problem: expect.stringMatching(/too short/),
    });
  });
});
