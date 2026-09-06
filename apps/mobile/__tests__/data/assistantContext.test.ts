import {
  answerFor,
  atsScoresFixture,
  buildAssistantContext,
  contentsFixture,
  resumesFixture,
  userFixture,
} from '@/data/mock';

const stripe = () => {
  const resume = resumesFixture.find((item) => item.id === 'res_2');
  if (!resume) throw new Error('res_2 missing');
  return { resume, content: contentsFixture.res_2, score: atsScoresFixture.res_2 };
};

/** §7.16 and §8.5: what the assistant may know about a document, and what it may never be handed. */
describe('assistantContext', () => {
  it('names the document, its real score and its real quick wins', () => {
    const { resume, content, score } = stripe();
    const context = buildAssistantContext({ resume, content, score });
    expect(context.documentTitle).toBe('Stripe — Senior PD');
    expect(context.targetRole).toBe('Senior Product Designer');
    expect(context.score).toBe(88);
    expect(context.band).toBe('strong');
    expect(context.quickWins.length).toBeGreaterThan(0);
    expect(context.quickWins.length).toBeLessThanOrEqual(3);
    expect(context.sections).toContain('experience');
  });

  /**
   * The rule is structural: the type has no field for an email, a phone or an address, and the
   * one borderline field on a document — `links` — is excluded entirely. This pins that no
   * contact-shaped string can appear, whatever the fixtures hold.
   */
  it('never carries contact details — not the account email, not a phone, not a link', () => {
    const { resume, content, score } = stripe();
    const serialised = JSON.stringify(buildAssistantContext({ resume, content, score }));
    expect(serialised).not.toContain(userFixture.email);
    expect(serialised).not.toMatch(/@/);
    expect(serialised).not.toMatch(/\d{10,}/);
    expect(serialised).not.toMatch(/https?:\/\//);
    expect(serialised).not.toMatch(/mailto:/);
  });

  it('names a section by NAME only, never its contents', () => {
    const { resume, content, score } = stripe();
    const context = buildAssistantContext({ resume, content, score });
    // A bullet from the body would be prose with a verb in it; the sections are single words.
    expect(context.sections.every((section) => /^[a-z]+$/.test(section))).toBe(true);
  });

  it("answers a score question with the document's own numbers, and says the rubric is ours", () => {
    const { resume, content, score } = stripe();
    const context = buildAssistantContext({ resume, content, score });
    const answer = answerFor('ats', context);
    expect(answer).toContain('Stripe — Senior PD');
    expect(answer).toContain('**88**');
    expect(answer).toMatch(/rubric/i);
    expect(answer).not.toMatch(/workday|greenhouse|taleo|lever|icims/i);
  });

  it('says so when there is no document open rather than inventing one', () => {
    expect(answerFor('ats', undefined)).toMatch(/don't have a scored document open/);
  });
});
