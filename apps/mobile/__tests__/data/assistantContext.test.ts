import { answerFor, buildAssistantContext, userFixture } from '@/data/mock';
import { atsQuickWins } from '@/data/models';
import { createMockStore } from '@/data/repos/state';

/** res_2 as the store seeds it: its score is the engines' (C-10), not a fixture's. */
const stripe = () => {
  const store = createMockStore();
  const resume = store.state.resumes.find((item) => item.id === 'res_2');
  const score = store.state.atsScores.res_2;
  if (!resume || !score) throw new Error('res_2 missing');
  return { resume, content: store.state.contents.res_2, score };
};

/** §7.16 and §8.5: what the assistant may know about a document, and what it may never be handed. */
describe('assistantContext', () => {
  it('names the document, its real score and its real quick wins', () => {
    const { resume, content, score } = stripe();
    const context = buildAssistantContext({ resume, content, score });
    expect(context.documentTitle).toBe('Stripe — Senior PD');
    expect(context.targetRole).toBe('Senior Product Designer');
    expect(context.score).toBe(score.total);
    expect(context.band).toBe(score.band);
    expect(context.quickWins.map((win) => win.label)).toEqual(
      atsQuickWins(score)
        .slice(0, 3)
        .map((item) => item.label),
    );
    // Fintech is on Stripe's listing and nothing on the profile backs it: a gap, by name.
    expect(context.gaps).toContain('Fintech');
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
    expect(answer).toContain(`**${score.total}**`);
    expect(answer).toMatch(/rubric/i);
    expect(answer).not.toMatch(/workday|greenhouse|taleo|lever|icims/i);
  });

  it('says so when there is no document open rather than inventing one', () => {
    expect(answerFor('ats', undefined)).toMatch(/don't have a scored document open/);
  });
});
