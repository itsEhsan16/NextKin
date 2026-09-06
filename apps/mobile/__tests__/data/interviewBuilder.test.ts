import {
  buildInterviewSet,
  contentsFixture,
  INTERVIEW_SET_MAX,
  INTERVIEW_SET_MIN,
  interviewSetsFixture,
  jdDraftsFixture,
  resumesFixture,
} from '@/data/mock';
import { interviewMarkCounts } from '@/data/models';

const stripe = () => {
  const resume = resumesFixture.find((item) => item.id === 'res_2');
  const draft = jdDraftsFixture.find((item) => item.id === 'jd_stripe');
  const content = contentsFixture.res_2;
  if (!resume || !draft || !content || content.kind !== 'resume')
    throw new Error('fixture missing');
  return { resume, draft, content };
};

const lower = (value: string) => value.toLowerCase();

/** The builder encodes §7.15's acceptance criteria; each is checked here without a mount. */
describe('interviewBuilder (V2 §7.15)', () => {
  it('grounds every technical question in a skill the resume claims AND the job asks for', () => {
    const { resume, draft, content } = stripe();
    const set = buildInterviewSet({
      setId: 'int_t',
      now: '2026-09-01T00:00:00.000Z',
      resume,
      draft,
      content,
    });

    const technical = set.questions.filter((question) => question.kind === 'technical');
    expect(technical.length).toBeGreaterThan(0);
    const claimed = content.skills.map(lower);
    const asked = [...draft.requiredSkills, ...draft.preferredSkills, ...draft.tools].map(lower);
    for (const question of technical) {
      expect(question.skill).toBeDefined();
      expect(claimed).toContain(lower(question.skill ?? ''));
      expect(asked).toContain(lower(question.skill ?? ''));
    }
    expect(set.source).toBe('resume');
    expect(set.resumeId).toBe('res_2');
    expect(set.jdId).toBe('jd_stripe');
    expect(set.title).toBe('Stripe — Senior Product Designer');
  });

  /**
   * §7.15: never rehearse a claim the document was not allowed to make. The score's unsupported
   * gaps stand in for the timeline engine's exclusions.
   */
  it('never writes a technical question about an excluded skill', () => {
    const { resume, draft, content } = stripe();
    const set = buildInterviewSet({
      setId: 'int_x',
      now: '2026-09-01T00:00:00.000Z',
      resume,
      draft,
      content,
      excludedSkills: ['Figma'],
    });
    expect(set.questions.some((question) => lower(question.skill ?? '') === 'figma')).toBe(false);
  });

  it('pads a short set toward the floor from the behavioural bank only, never inventing a skill', () => {
    const { resume, content } = stripe();
    // A thin resume and no JD: one technical question and two role questions is all the inputs
    // support, so the rest of the floor has to come from the bank.
    const set = buildInterviewSet({
      setId: 'int_p',
      now: '2026-09-01T00:00:00.000Z',
      resume,
      content: { ...content, skills: ['Figma'] },
    });
    expect(set.questions.length).toBeGreaterThanOrEqual(INTERVIEW_SET_MIN);
    expect(set.questions.length).toBeLessThanOrEqual(INTERVIEW_SET_MAX);
    const padded = set.questions.filter((question) => question.id.startsWith('q_bank_'));
    expect(padded.length).toBeGreaterThan(0);
    expect(padded.every((question) => question.kind === 'behavioural' && !question.skill)).toBe(
      true,
    );
  });

  it('writes a standalone set from the role title alone and flags it generic', () => {
    const set = buildInterviewSet({
      setId: 'int_s',
      now: '2026-09-01T00:00:00.000Z',
      roleTitle: 'Senior Data Engineer',
      generationId: 'gen_s',
    });
    expect(set.source).toBe('standalone');
    expect(set.roleTitle).toBe('Senior Data Engineer');
    expect(set.resumeId).toBeUndefined();
    expect(set.generationId).toBe('gen_s');
    expect(set.questions).toHaveLength(INTERVIEW_SET_MIN);
    expect(
      set.questions.every((question) => question.kind === 'behavioural' && !question.skill),
    ).toBe(true);
  });

  it('is deterministic', () => {
    const { resume, draft, content } = stripe();
    const input = { setId: 'int_d', now: '2026-09-01T00:00:00.000Z', resume, draft, content };
    expect(buildInterviewSet(input)).toEqual(buildInterviewSet(input));
  });

  it('seeds the fixture set from the same rules, with marks the practice filters can show', () => {
    const [seeded] = interviewSetsFixture;
    expect(seeded?.id).toBe('int_stripe');
    const counts = interviewMarkCounts(seeded ?? { questions: [] });
    expect(counts.confident).toBe(2);
    expect(counts.needsWork).toBe(1);
    expect(counts.total).toBe(counts.marked + counts.unmarked);
  });
});
