import { describe, expect, it } from 'vitest';

import { withoutDoubledWord } from '../src/scoring/documentFacts';
import { holdOfText, holdTerms, mentionsOf } from '../src/scoring/keywordHold';

/** A job's phrases, counted the way an outside keyword checker counts them (owner, 2026-11-25). */

describe('counting a phrase', () => {
  it('counts whole words in any case, never part of a longer word', () => {
    expect(mentionsOf('Used Go and go-kit; a good Go service', 'Go')).toBe(3);
    expect(mentionsOf('good gopher', 'Go')).toBe(0);
    expect(mentionsOf('End-to-End (E2E) Testing of the app; end-to-end (e2e) testing again', 'End-to-End (E2E) Testing')).toBe(2);
    expect(mentionsOf('browser UI and UI work', 'UI')).toBe(2);
    expect(mentionsOf('built the GUI', 'UI')).toBe(0);
    expect(mentionsOf('anything', '  ')).toBe(0);
  });
});

describe('what a resume should hold', () => {
  const job = { skills: ['Log Analysis', 'Data Pipeline', 'log analysis', 'Kafka', ' '], rawText: 'Log Analysis. Data pipeline validation across data pipelines and one more data pipeline. Kafka.' };

  it('lists each phrase once and asks for it as often as the job says it, at most twice', () => {
    expect(holdTerms(job)).toEqual([
      { term: 'Log Analysis', want: 1 },
      { term: 'Data Pipeline', want: 2 },
      { term: 'Kafka', want: 1 },
    ]);
  });

  it('a text that paraphrases holds less than one that uses the job’s words', () => {
    const terms = holdTerms(job);
    const exact = holdOfText('Did Log Analysis on a data pipeline feeding Kafka, then rebuilt the data pipeline.', terms);
    const loose = holdOfText('Analyzed logs on a data pipeline feeding Kafka.', terms);
    expect(exact).toEqual({ held: 4, short: [], missing: [] });
    expect(loose).toEqual({ held: 2, short: [{ term: 'Data Pipeline', have: 1, want: 2 }], missing: ['Log Analysis'] });
  });
});

describe('a result line with a doubled word', () => {
  it('says the word once', () => {
    expect(withoutDoubledWord('support workflow improvements that removed 10 manual manual steps from the process.')).toBe('support workflow improvements that removed 10 manual steps from the process.');
    expect(withoutDoubledWord('prevented 10+ defects defects in production')).toBe('prevented 10+ defects in production');
    expect(withoutDoubledWord('keeping 5 teams Teams teams aligned')).toBe('keeping 5 teams aligned');
  });

  it('leaves numbers and short words alone', () => {
    expect(withoutDoubledWord('grew from 10 10-person teams to 20')).toBe('grew from 10 10-person teams to 20');
    expect(withoutDoubledWord('it is is fine')).toBe('it is is fine');
    expect(withoutDoubledWord('the manual, manual steps')).toBe('the manual, manual steps');
  });
});
