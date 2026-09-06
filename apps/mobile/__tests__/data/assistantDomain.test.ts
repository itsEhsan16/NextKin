import { classify, REFUSAL_LINE } from '@/data/mock';
import { ASSISTANT_SCOPE_LINE } from '@/data/models';

/**
 * The mock's stand-in for §7.16's off-topic test set.
 *
 * Read the caveat before trusting the numbers: this measures a KEYWORD MATCHER against a list the
 * same author wrote. It is not the spec's ≥95% acceptance criterion, which is a claim about a real
 * small-model classifier. What this suite pins is the contract the screen relies on — allowed
 * questions are answered, the listed off-topic ones are refused, and the refusal restates scope.
 */
const ON_TOPIC: readonly string[] = [
  'Why is my ATS score 88?',
  'How do I explain a career gap?',
  'What does ATS-optimised mean?',
  'Should my resume be one page or two?',
  'How do I write a cover letter for a fintech role?',
  'Tell me about yourself — how should I answer that?',
  'How do I prepare for a technical round?',
  'Is it worth learning Figma or React first?',
  'How do I negotiate a salary offer?',
  'How many jobs should I apply to a week?',
  'What is a good headline for my profile?',
  'How do I ask for a referral?',
  'My notice period is three months, is that a problem?',
  'Can I export to DOCX on the free plan?',
  'What counts as a generation on NextKin?',
  'How do I make my bullets sound stronger?',
  'What should I put in the summary section?',
  'How do recruiters read a CV?',
  'What is the STAR method?',
  'Which skills are missing from my resume for this job?',
  'How do I switch careers into design systems?',
  'I was laid off last month, what do I say in interviews?',
  'Do keywords really matter for the parser?',
  'How do I tailor my resume to a job description?',
];

const OFF_TOPIC: readonly string[] = [
  "What's the weather like in Bengaluru today?",
  'Give me a recipe for dal.',
  'Write a poem about the sea.',
  'Who won the cricket last night?',
  'Translate this sentence into German.',
  'Write me a python script to rename files.',
  'Tell me a joke.',
  'What is the bitcoin price?',
  'Can you diagnose my symptoms?',
  'Should I sue my landlord?',
  'Recommend a movie for tonight.',
  '',
  '   ',
];

describe('assistantDomain — the keyword domain lock (V2 §7.16)', () => {
  it.each(ON_TOPIC)('answers: %s', (text) => {
    expect(classify(text).allowed).toBe(true);
  });

  it.each(OFF_TOPIC)('refuses: %s', (text) => {
    expect(classify(text)).toEqual({ allowed: false, reason: 'off_topic' });
  });

  it('lets a deny term beat a weak allow — a poem about a job is a poem', () => {
    expect(classify('Write a poem about my job').allowed).toBe(false);
  });

  it('picks the topic with the most vocabulary, so the answer is about the right thing', () => {
    const verdict = classify('Why is my ATS score low — which keywords am I missing?');
    expect(verdict).toEqual({ allowed: true, topic: 'ats' });
  });

  it('refuses in a way a false refusal can recover from: it restates what it CAN do', () => {
    expect(REFUSAL_LINE).toContain(ASSISTANT_SCOPE_LINE);
    expect(REFUSAL_LINE).not.toMatch(/not allowed|forbidden|prohibited/i);
  });

  it("never prints the spec's accuracy claim anywhere in its copy", () => {
    expect(REFUSAL_LINE).not.toMatch(/95/);
    expect(ASSISTANT_SCOPE_LINE).not.toMatch(/95/);
  });
});
