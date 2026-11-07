import { classify } from '@nextkin/shared/assistant/domain';

import type { AssistantMessage } from '@/data/models';
import { followUps, plainText, starterPrompts } from '@/features/assistant/assistantPrompts';

const turn = (role: AssistantMessage['role'], text: string, over: Partial<AssistantMessage> = {}) =>
  ({
    id: text,
    role,
    text,
    createdAt: '2026-11-08',
    status: 'complete',
    ...over,
  }) as AssistantMessage;

describe('assistant prompts (§188)', () => {
  it('starts from the resume in use and its real score', () => {
    const prompts = starterPrompts({ resumeTitle: 'UX', score: 78, quickWins: 2 }).map(
      (item) => item.prompt,
    );
    expect(prompts[0]).toBe('Why does my resume score 78?');
    expect(prompts).toContain('Which quick wins should I fix first?');
  });

  it('never offers to fix what has nothing left to fix', () => {
    const prompts = starterPrompts({ resumeTitle: 'UX', score: 94, quickWins: 0 }).map(
      (item) => item.prompt,
    );
    expect(prompts.join(' ')).not.toMatch(/quick win/i);
  });

  it('without a resume, asks the questions someone starting out has', () => {
    const prompts = starterPrompts({}).map((item) => item.prompt);
    expect(prompts).toContain('What makes a strong resume?');
    expect(prompts).toContain('Which skills should I learn next?');
  });

  it('uses the role named at sign-up', () => {
    const prompts = starterPrompts({ role: 'Product Designer' }).map((item) => item.prompt);
    expect(prompts).toContain('Which skills do Product Designer roles ask for?');
  });

  it('every prompt it can offer passes the topic check, so a tap is never refused', () => {
    const all = [
      ...starterPrompts({ resumeTitle: 'UX', score: 70, quickWins: 1, role: 'Data Analyst' }),
      ...starterPrompts({}),
    ].map((item) => item.prompt);
    for (const topic of ['ats', 'resume', 'interview', 'job search', 'skills', 'nextkin']) {
      const thread = [turn('user', `question about ${topic}`), turn('assistant', 'answer')];
      all.push(...followUps(thread, { max: 9 }));
    }
    expect(all.filter((prompt) => !classify(prompt).allowed)).toEqual([]);
  });

  it('follows up on the same topic, skips what was asked, and stays quiet after a refusal', () => {
    const thread = [
      turn('user', 'How do I use the STAR method?'),
      turn('assistant', 'Situation, task, action, result.'),
    ];
    const next = followUps(thread);
    expect(next).toHaveLength(2);
    expect(next).not.toContain('How do I use the STAR method?');
    expect(
      followUps([turn('user', 'weather?'), turn('assistant', 'No.', { refusal: 'off_topic' })]),
    ).toEqual([]);
  });

  it('copies answers without the bold marks', () => {
    expect(plainText('Your **UX** scores **78**.')).toBe('Your UX scores 78.');
  });
});
