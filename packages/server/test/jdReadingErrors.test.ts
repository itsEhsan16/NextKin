import { describe, expect, it } from 'vitest';

import { LlmError } from '../src/ai/types';
import { jdExtractionSchema, KEPT, keptLists, verify, type JdExtraction } from '../src/pipeline/stages/extractJd';
import { JD_FAILURE, readingFailureOf } from '../src/services/jd';

/** A job description that can't be read says why, and a long one is read (owner, 2026-11-23). */

const none: JdExtraction = {
  language: 'en', title: null, company: null, department: null, industry: null, employmentType: null, seniority: null, openings: null, referenceId: null, summary: null,
  locations: [], workModes: [], schedule: [], pay: [], negotiable: null, experience: [], responsibilities: [], skills: [], education: [], languages: [], benefits: [], eligibility: [], companyAbout: [], website: null, application: [], extras: [], issues: [],
};

// A posting of the shape that failed on the demo: a long list of short duty lines.
const duties = Array.from({ length: 150 }, (_, i) => `Track critical defect number ${i + 1} and support the release decision.`);
const RAW = `QA Lead\nResponsibilities\n${duties.map((d) => `• ${d}`).join('\n')}`;

describe('a long posting', () => {
  it('a model answer listing every duty is accepted, not refused for its length', () => {
    const answer = { ...none, responsibilities: duties.map((d) => ({ text: d, quote: d, group: null })) };
    expect(jdExtractionSchema.safeParse(answer).success).toBe(true);
  });

  it('keeps the first of each list up to the stored sizes, and reads the rest of the posting', () => {
    const answer = { ...none, responsibilities: duties.map((d) => ({ text: d, quote: d, group: null })) };
    expect(keptLists(answer).responsibilities).toHaveLength(KEPT.responsibilities);
    const jd = verify(RAW, answer);
    expect(jd.structured?.responsibilities.length).toBeGreaterThan(0);
    expect(jd.structured!.responsibilities.length).toBeLessThanOrEqual(KEPT.responsibilities);
  });
});

describe('why a reading failed', () => {
  it('names each model failure for what it is', () => {
    expect(readingFailureOf(new LlmError('overloaded', 'x', true))).toEqual({ reason: 'busy', text: JD_FAILURE.busy });
    expect(readingFailureOf(new LlmError('timeout', 'x', true)).reason).toBe('busy');
    expect(readingFailureOf(new LlmError('bad_request', 'x', false))).toEqual({ reason: 'too_long', text: JD_FAILURE.too_long });
    expect(readingFailureOf(new LlmError('invalid_output', 'x', false))).toEqual({ reason: 'unclear', text: JD_FAILURE.unclear });
    expect(readingFailureOf(new LlmError('auth', 'x', false))).toEqual({ reason: 'service_down', text: JD_FAILURE.service_down });
    expect(readingFailureOf(new LlmError('capped', 'x', false)).reason).toBe('service_down');
    expect(readingFailureOf(new LlmError('error', 'The provider answered 402.', false)).reason).toBe('service_down');
    expect(readingFailureOf(new TypeError('x of undefined'))).toEqual({ reason: 'internal', text: JD_FAILURE.internal });
  });

  it('never tells the candidate to "try again in a moment" for a failure that won’t pass', () => {
    for (const failure of ['auth', 'capped', 'bad_request', 'invalid_output'] as const) {
      expect(readingFailureOf(new LlmError(failure, 'x', false)).text).not.toMatch(/in a moment/);
    }
  });
});
