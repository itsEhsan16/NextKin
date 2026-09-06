import {
  YEARS_MAX,
  ZERO_RESUME_GUARDRAIL_BODY,
  ZERO_RESUME_GUARDRAIL_TITLE,
  emptyZeroResumeDraft,
  fullNameOf,
  jdIsReady,
  parseYears,
  validateZeroResume,
  zeroSeed,
  type ZeroResumeDraft,
} from '@/features/create/zeroResume';

const draftWith = (patch: Partial<ZeroResumeDraft> = {}): ZeroResumeDraft => ({
  ...emptyZeroResumeDraft,
  fullName: 'George Smith',
  yearsExperience: '4',
  ...patch,
});

const errorsOf = (draft: ZeroResumeDraft): Record<string, string> => {
  const result = validateZeroResume(draft);
  return result.ok ? {} : result.errors;
};

describe('zeroResume — the §7.9 guardrail copy', () => {
  // Pinned verbatim. This is the promise the whole feature rests on: the draft says what it does
  // not know, and nothing on it is invented as fact. A softened line here is a product bug.
  it('says what will be missing, names the placeholder, and refuses to invent', () => {
    expect(ZERO_RESUME_GUARDRAIL_TITLE).toBe('This draft will be full of blanks on purpose');
    expect(ZERO_RESUME_GUARDRAIL_BODY).toBe(
      'We only know what you type on this page. Everything else is left as a placeholder for you ' +
        'to fill in: roles come out as [Company Name], schools as [Institution], and dates as ' +
        'ranges we worked out from your years of experience. Nothing is invented as fact — no ' +
        'employer, no credential, no skill you did not tell us about. Every assumed line is ' +
        'marked "needs review", and the draft cannot be downloaded until you have replaced or ' +
        'confirmed each one.',
    );
  });

  it('never claims a result in a named third-party ATS (V2 §7.8)', () => {
    const named = /workday|greenhouse|taleo|lever|icims/i;
    expect(named.test(ZERO_RESUME_GUARDRAIL_TITLE)).toBe(false);
    expect(named.test(ZERO_RESUME_GUARDRAIL_BODY)).toBe(false);
  });
});

describe('zeroResume — parseYears', () => {
  it('reads whole years, zero included', () => {
    expect(parseYears('0')).toBe(0);
    expect(parseYears(' 12 ')).toBe(12);
  });

  it('refuses anything that is not a plain count of years', () => {
    expect(parseYears('')).toBeNull();
    expect(parseYears('3.5')).toBeNull();
    expect(parseYears('-2')).toBeNull();
    expect(parseYears('about four')).toBeNull();
  });
});

describe('zeroResume — validateZeroResume', () => {
  it('accepts a name and zero years, which is the case this mode exists for', () => {
    expect(validateZeroResume(draftWith({ yearsExperience: '0' }))).toEqual({ ok: true });
  });

  it('leaves the target title and the location optional', () => {
    expect(validateZeroResume(draftWith({ targetTitle: '', location: '' })).ok).toBe(true);
  });

  it('asks for a name in words rather than calling the field invalid', () => {
    expect(errorsOf(draftWith({ fullName: '   ' })).fullName).toBe(
      'Add the name you want printed on the resume.',
    );
  });

  it('tells the empty years field apart from a typed zero', () => {
    expect(errorsOf(draftWith({ yearsExperience: '' })).yearsExperience).toBe(
      'Tell us how many years you have worked. Type 0 if you are starting out.',
    );
    expect(errorsOf(draftWith({ yearsExperience: '0' })).yearsExperience).toBeUndefined();
  });

  it('says what a number should look like, and where the range stops', () => {
    expect(errorsOf(draftWith({ yearsExperience: '3.5' })).yearsExperience).toBe(
      'Write this as whole years in digits — 0, 2 or 15.',
    );
    expect(errorsOf(draftWith({ yearsExperience: String(YEARS_MAX + 1) })).yearsExperience).toBe(
      `${YEARS_MAX} years is the most we can build a draft from.`,
    );
    expect(
      errorsOf(draftWith({ yearsExperience: String(YEARS_MAX) })).yearsExperience,
    ).toBeUndefined();
  });

  it('caps the one-line fields', () => {
    const long = 'x'.repeat(200);
    const errors = errorsOf(draftWith({ fullName: long, targetTitle: long, location: long }));
    expect(errors.fullName).toContain('200 characters');
    expect(errors.targetTitle).toBeDefined();
    expect(errors.location).toBeDefined();
  });
});

describe('zeroResume — jdIsReady', () => {
  it('needs a job description at all (§7.9 lists it among the three inputs)', () => {
    expect(jdIsReady(null, false)).toBe(false);
  });

  it('treats a whitespace paste as nothing pasted', () => {
    expect(jdIsReady({ source: 'paste', text: '   \n ' }, false)).toBe(false);
    expect(jdIsReady({ source: 'paste', text: 'Senior Product Designer' }, false)).toBe(true);
  });

  it('waits for a saved job to actually load before it counts', () => {
    expect(jdIsReady({ source: 'job', jobId: 'job_1' }, false)).toBe(false);
    expect(jdIsReady({ source: 'job', jobId: 'job_1' }, true)).toBe(true);
  });

  it('takes a chosen file at face value', () => {
    expect(
      jdIsReady(
        { source: 'file', file: { name: 'jd.pdf', uri: 'file://jd.pdf', size: 10 } },
        false,
      ),
    ).toBe(true);
  });
});

describe('zeroResume — zeroSeed', () => {
  it('trims what it sends and omits the optional fields that are blank', () => {
    expect(
      zeroSeed(draftWith({ fullName: '  George Smith ', targetTitle: ' ', location: '' })),
    ).toEqual({ fullName: 'George Smith', yearsExperience: 4 });
  });

  it('carries the optional fields when they are filled', () => {
    expect(
      zeroSeed(
        draftWith({ yearsExperience: '0', targetTitle: ' Product Designer ', location: ' Pune ' }),
      ),
    ).toEqual({
      fullName: 'George Smith',
      yearsExperience: 0,
      targetTitle: 'Product Designer',
      location: 'Pune',
    });
  });
});

describe('zeroResume — fullNameOf', () => {
  it('joins the two halves of the fixture user', () => {
    expect(fullNameOf({ firstName: 'George', lastName: 'Smith' })).toBe('George Smith');
  });

  it('does not leave a dangling space when half of it is missing', () => {
    expect(fullNameOf({ firstName: 'George', lastName: '' })).toBe('George');
  });
});
