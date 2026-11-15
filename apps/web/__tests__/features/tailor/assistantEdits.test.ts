import { isEditRequest } from '@/features/tailor/components/ResumeAssistantPanel';
import { sectionsOf } from '@/features/tailor/tailorLibrary';

/**
 * What the review's assistant treats as "change my resume", and which parts a request reaches
 * (owner, 2026-11-15: more power). A question must still be answered, never acted on.
 */
describe('an edit request, however it is phrased', () => {
  it.each([
    'Shorten my summary to remove filler words',
    'Please remove skills not related to this job',
    'Can you tighten my experience bullets?',
    'Could you please polish my whole resume',
    'I want to make my summary shorter',
    'I’d like you to reword my projects',
    "Let's fix the skills order",
    'Help me strengthen my latest role',
    'Also, trim the summary',
    'Emphasise leadership in my experience',
  ])('acts on "%s"', (text) => {
    expect(isEditRequest(text)).toBe(true);
  });

  it.each([
    'Why is my ATS score what it is?',
    'What should I improve next for this job?',
    'How do I add a result to a bullet?',
    'Is my summary too long?',
    'Can you explain the score?',
    'Which skills is this job missing?',
  ])('answers "%s" instead', (text) => {
    expect(isEditRequest(text)).toBe(false);
  });
});

describe('the parts a request reaches', () => {
  it('one part when it names one', () => {
    expect(sectionsOf('Shorten my summary')).toEqual(['summary']);
    expect(sectionsOf('Use stronger action verbs for my latest experience')).toEqual(['experience']);
    // "this job" is the target, not the work history.
    expect(sectionsOf('Remove skills not related to this job')).toEqual(['skills']);
  });

  it('every part it names, in the resume’s order', () => {
    expect(sectionsOf('Tidy my skills and shorten the summary')).toEqual(['summary', 'skills']);
    expect(sectionsOf('Reword my projects, bullets and profile')).toEqual([
      'summary',
      'experience',
      'projects',
    ]);
  });

  it('all of them for the whole resume, unless a part is named', () => {
    expect(sectionsOf('Polish my whole resume for this job')).toEqual([
      'summary',
      'skills',
      'experience',
      'projects',
    ]);
    expect(sectionsOf('Make everything more concise')).toHaveLength(4);
    expect(sectionsOf('Shorten my summary so my resume fits one page')).toEqual(['summary']);
  });

  it('none when it names nothing, so the assistant asks which', () => {
    expect(sectionsOf('Make the dates consistent')).toEqual([]);
  });
});
