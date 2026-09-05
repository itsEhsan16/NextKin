import { SKILL_DICTIONARY, jdDraftsFixture } from '@/data/mock/fixtures/jd';
import { jobsFixture } from '@/data/mock/fixtures/jobs';
import { nowIso } from '@/data/mock/fixtures/time';
import { extractJdDraft, type JdExtractContext } from '@/data/mock/jdExtractor';

const ctx: JdExtractContext = {
  jobs: jobsFixture,
  dictionary: SKILL_DICTIONARY,
  id: 'jd_test',
  now: nowIso(),
};

/** Six dictionary skills, no stated split — so the 60% rule decides where the line falls. */
const SIX_SKILLS = [
  'Senior Product Designer at Swiggy',
  '',
  'You will own checkout and payments for the food ordering app.',
  '- Run user research and usability testing with customers in Bengaluru',
  '- Ship high-fidelity prototypes in Figma',
  '- Extend our design systems work',
].join('\n');

/** The same skills, but the description says itself which half is which. */
const STATED_SPLIT = [
  'Product Designer at Razorpay',
  '',
  'Must have',
  '- Deep Figma craft and prototyping',
  '- Experience with design systems',
  '',
  'Nice to have',
  '- Exposure to accessibility and WCAG',
  '- Reading analytics in Mixpanel',
].join('\n');

describe('extractJdDraft — pasted text', () => {
  it('splits the skills it finds in appearance order, 60% of them required', () => {
    const draft = extractJdDraft({ source: 'paste', text: SIX_SKILLS }, ctx);

    expect([...draft.requiredSkills, ...draft.preferredSkills]).toEqual([
      'checkout',
      'payments',
      'user research',
      'usability testing',
      'Figma',
      'design systems',
    ]);
    expect(draft.requiredSkills).toHaveLength(4);
    expect(draft.preferredSkills).toEqual(['Figma', 'design systems']);
  });

  it('lets a stated must-have / nice-to-have split beat the 60% rule', () => {
    const draft = extractJdDraft({ source: 'paste', text: STATED_SPLIT }, ctx);

    expect(draft.requiredSkills).toEqual(['Figma', 'prototyping', 'design systems']);
    expect(draft.preferredSkills).toEqual(['accessibility', 'WCAG', 'analytics', 'Mixpanel']);
    // Under the 60% rule the first five would have been required; accessibility is the tell.
    expect(draft.requiredSkills).not.toContain('accessibility');
  });

  it('ignores "required" and "preferred" in prose, so only headings state the split', () => {
    const text = [
      'Designer',
      'A degree is not required.',
      'Figma, prototyping, design systems, analytics, SQL are preferred.',
    ].join('\n');
    const draft = extractJdDraft({ source: 'paste', text }, ctx);

    // Read as a stated split these five would all be required — the sentence says the opposite.
    expect(draft.requiredSkills).toEqual(['Figma', 'prototyping', 'design systems']);
    expect(draft.preferredSkills).toEqual(['analytics', 'SQL']);
  });

  it('takes the title from the first non-empty line and caps it', () => {
    const draft = extractJdDraft({ source: 'paste', text: `\n\n${SIX_SKILLS}` }, ctx);
    expect(draft.title).toBe('Senior Product Designer at Swiggy');

    const long = extractJdDraft({ source: 'paste', text: `${'Product Designer '.repeat(9)}` }, ctx);
    expect(long.title.length).toBeLessThanOrEqual(80);
    expect(long.title.startsWith('Product Designer')).toBe(true);
  });

  it('reads the company when the text names one', () => {
    expect(extractJdDraft({ source: 'paste', text: SIX_SKILLS }, ctx).company).toBe('Swiggy');
    const labelled = 'Product Designer\nCompany — PhonePe\nWe are hiring.';
    expect(extractJdDraft({ source: 'paste', text: labelled }, ctx).company).toBe('PhonePe');
  });

  it('leaves the company undefined rather than guessing one', () => {
    const text = 'Product Designer, payments team\nWe want someone to own checkout end to end.';
    const draft = extractJdDraft({ source: 'paste', text }, ctx);

    expect(draft.company).toBeUndefined();
    // Absent, not present-and-undefined: the store round-trips drafts through JSON, which would
    // drop such a key and leave the stored draft unequal to the one the extractor returned.
    expect(Object.prototype.hasOwnProperty.call(draft, 'company')).toBe(false);
    expect(draft.requiredSkills.length).toBeGreaterThan(0);
  });

  it('keeps the pasted text verbatim and lists the bulleted lines as responsibilities', () => {
    const draft = extractJdDraft({ source: 'paste', text: SIX_SKILLS }, ctx);

    expect(draft.rawText).toBe(SIX_SKILLS);
    expect(draft.responsibilities).toEqual([
      'You will own checkout and payments for the food ordering app.',
      'Run user research and usability testing with customers in Bengaluru',
      'Ship high-fidelity prototypes in Figma',
      'Extend our design systems work',
    ]);
    expect(draft.tools).toEqual(['Figma']);
  });

  it('gives the same draft for the same input', () => {
    const input = { source: 'paste', text: SIX_SKILLS } as const;
    expect(extractJdDraft(input, ctx)).toStrictEqual(extractJdDraft(input, ctx));
  });
});

describe('extractJdDraft — a job listing', () => {
  it('builds the draft from the listing rather than from its text', () => {
    const draft = extractJdDraft({ source: 'job', jobId: 'job_stripe' }, ctx);

    expect(draft.title).toBe('Senior Product Designer');
    expect(draft.company).toBe('Stripe');
    expect(draft.location).toBe('Bengaluru');
    expect(draft.experienceLevel).toBe('senior');
    expect(draft.jobId).toBe('job_stripe');
    // Tags the dictionary knows are required; the rest are preferred.
    expect(draft.requiredSkills).toEqual(['Design systems', 'Figma']);
    expect(draft.preferredSkills).toEqual(['Fintech']);
    expect(draft.tools).toEqual(['Figma']);
    expect(draft.responsibilities).toEqual([
      'Own onboarding flows across web and mobile',
      'Partner with research to run monthly usability tests',
      'Contribute to and extend the Stripe design system',
      'Mentor two mid-level designers',
    ]);
    expect(draft.rawText).toContain('Senior Product Designer at Stripe');
  });

  it('throws for a job it does not have, so the repo can report it', () => {
    expect(() => extractJdDraft({ source: 'job', jobId: 'job_missing' }, ctx)).toThrow(
      'job_missing',
    );
  });

  it('agrees with the saved jd_stripe fixture', () => {
    const [fixture] = jdDraftsFixture;
    if (!fixture) throw new Error('jdDraftsFixture is empty');
    const draft = extractJdDraft({ source: 'job', jobId: 'job_stripe' }, ctx);

    // The fixture claims to be an extraction of job_stripe, so every extracted field has to
    // match one — rawText included, or the saved draft shows text the extractor never produced.
    expect({ ...fixture, id: draft.id, createdAt: draft.createdAt }).toStrictEqual(draft);
  });
});

describe('extractJdDraft — an uploaded file', () => {
  const file = { name: 'razorpay-product-designer-jd.pdf', uri: 'file:///docs/jd.pdf' };

  it('uses the file name as the title and extracts the stand-in body', () => {
    const draft = extractJdDraft({ source: 'file', file }, ctx);

    expect(draft.source).toBe('file');
    expect(draft.title).toBe('razorpay-product-designer-jd');
    // The mock does not parse the upload; what it read is visible as rawText.
    expect(draft.rawText.length).toBeGreaterThan(0);
    expect(draft.requiredSkills).toContain('Figma');
  });

  it('gives the same draft for the same file', () => {
    expect(extractJdDraft({ source: 'file', file }, ctx)).toStrictEqual(
      extractJdDraft({ source: 'file', file }, ctx),
    );
  });
});
