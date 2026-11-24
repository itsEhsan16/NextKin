import { render, screen } from '@testing-library/react-native';

import type { AssistantMessage } from '@/data/models';
import { MessageBubble } from '@/features/assistant/components/MessageBubble';
import { atsBlocker, JD_MAX, PASTE_SHORT } from '@/features/create/atsCheckSetup';
import { jdFailedLede } from '@/features/create/jdFailure';
import { readyDocumentIssue } from '@/features/generations/components/ReadyDocumentProblem';

/** toreview §262: on the phone too, every AI failure says why and nothing waits for ever. */

describe('a pasted job description', () => {
  const pasted = (n: number) =>
    'Evaluate defect severity and business impact. '.repeat(Math.ceil(n / 47)).slice(0, n);
  const blocker = (text: string) =>
    atsBlocker({ hasFile: true, mode: 'paste', hasJob: false, pasted: text });

  it('takes the server’s whole limit, not the 2,000 the board drew', () => {
    expect(JD_MAX).toBe(20_000);
    expect(blocker(pasted(15_000))).toBeUndefined();
  });

  it('says how long an over-long paste is and what to remove, instead of cutting it', () => {
    expect(blocker(pasted(20_500))).toMatch(
      /characters; up to 20,000 fit\. Remove the company introduction/,
    );
  });

  it('says a paste is too short', () => {
    expect(blocker('QA lead')).toBe(PASTE_SHORT);
  });
});

describe('a finished run’s document', () => {
  const content = (over: Partial<{ data: unknown; isError: boolean; isPending: boolean }>) => ({
    data: undefined,
    isError: false,
    isPending: false,
    ...over,
  });

  it('is said missing when the run names none, never a skeleton for ever', () => {
    expect(readyDocumentIssue('', content({ isPending: true }), false)).toBe('missing');
  });

  it('is an error only when nothing is cached', () => {
    expect(readyDocumentIssue('r1', content({ isError: true }), false)).toBe('error');
    expect(
      readyDocumentIssue('r1', content({ isError: true, data: { kind: 'resume' } }), true),
    ).toBeNull();
  });

  it('is said missing when it is not the kind of document expected', () => {
    expect(readyDocumentIssue('r1', content({ data: { kind: 'cover_letter' } }), false)).toBe(
      'missing',
    );
  });
});

describe('a job description that could not be read', () => {
  it('says why for each reason, else the server’s sentence', () => {
    expect(jdFailedLede({ failureReason: 'service_down' })).toMatch(/on our side/);
    expect(jdFailedLede({ failureReason: 'too_long' })).toMatch(/too long/);
    expect(jdFailedLede({ error: 'Not a job description.' })).toBe('Not a job description.');
  });
});

describe('an assistant reply that failed', () => {
  const reply = (text: string): AssistantMessage =>
    ({
      id: 'm1',
      role: 'assistant',
      text,
      status: 'failed',
      createdAt: '2026-11-23T00:00:00Z',
    }) as AssistantMessage;

  it('with nothing written, says no answer came back', async () => {
    await render(<MessageBubble message={reply('')} />);
    expect(screen.getByText('No answer came back. Ask again.')).toBeTruthy();
  });

  it('part-written, says it stopped part-way', async () => {
    await render(<MessageBubble message={reply('Here is how to')} />);
    expect(screen.getByText('That answer stopped part-way.')).toBeTruthy();
  });
});
