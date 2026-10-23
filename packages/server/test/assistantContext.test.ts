import { documentBody } from '@nextkin/shared/assistant/documentBody';
import type { ResumeContent } from '@nextkin/shared/models';
import { redactPersonal } from '@nextkin/shared/privacy/contact';
import { describe, expect, it } from 'vitest';

import { createEvalGateway } from '../evals/gateway';
import { createModelBrain, createStandInBrain, type ServerAssistantContext } from '../src/assistant/brain';
import { assertNoContact } from '../src/ai/pii';
import { createFakeProvider } from '../src/ai/providers/fake';
import { PROMPTS } from '../src/seed/prompts';

/** The assistant reads the open document's text (toreview §109), never its contact details. */

const fromSeed = async (name: string) => ({ id: `seed:${name}`, body: PROMPTS.find((p) => p.name === name)!.body });

const content: ResumeContent = {
  kind: 'resume',
  resumeId: 'r1',
  versionId: 'v1',
  headline: 'Backend Engineer',
  contact: { email: 'jo.bauer@example.com', phone: '+49 30 1234567' },
  summary: 'Jo Bauer ships payment systems.',
  skills: ['Go', 'PostgreSQL'],
  experience: [{ id: 'x', company: 'Lumen Pay', title: 'Senior Backend Engineer', period: '2020 — Present', bullets: ['Cut API p99 latency from 800 ms to 440 ms by reworking PostgreSQL indexes', 'Reach me at jo.bauer@example.com'] }],
  projects: [],
  certifications: [],
  education: [],
  links: ['https://github.com/jobauer'],
};

const context: ServerAssistantContext = {
  documentTitle: 'Backend Resume',
  quickWins: [],
  gaps: [],
  sections: ['summary', 'skills', 'experience'],
  body: documentBody(content, (t) => redactPersonal(t, ['Jo', 'Bauer'])),
  requirements: [],
};

describe('the reply with the document body', () => {
  it('sends the bullets, and nothing the contact guard would refuse', async () => {
    expect(() => assertNoContact({ context })).not.toThrow();
    const provider = createFakeProvider();
    const brain = createModelBrain(createEvalGateway(provider), fromSeed);
    await brain.reply({ text: 'What is wrong in my resume?', previous: [], userId: 'u', topic: 'resume', context }, () => undefined);
    const sent = provider.calls[0]!.messages[0]!.content;
    expect(sent).toContain('Cut API p99 latency from 800 ms to 440 ms');
    expect(sent).not.toMatch(/jo\.bauer|github\.com|\+49|Bauer/i);
    expect(provider.calls[0]!.system.map((b) => b.text).join(' ')).toContain('the open document’s own text');
  });

  it('the classifier is told when a document came with the message', async () => {
    const provider = createFakeProvider({ script: (request) => (request.output?.name === 'assistant_scope' ? { data: { inScope: true, topic: 'resume' }, stopReason: 'tool_use', text: '' } : undefined) });
    const brain = createModelBrain(createEvalGateway(provider), fromSeed);
    await brain.classify({ text: 'Is it good?', previous: [], userId: 'u', hasAttachment: true });
    expect(provider.calls[0]!.messages[0]!.content).toMatch(/"hasAttachment":\s*true/);
  });
});

describe('the stand-in with an attachment', () => {
  it('reads a short question about the attachment as about the resume', async () => {
    const brain = createStandInBrain();
    expect(await brain.classify({ text: 'What is wrong in this?', previous: [], userId: 'u', hasAttachment: true })).toEqual({ inScope: true, topic: 'resume' });
    expect((await brain.classify({ text: 'What is wrong in this?', previous: [], userId: 'u' })).inScope).toBe(false);
    expect((await brain.classify({ text: 'Write a poem about this.', previous: [], userId: 'u', hasAttachment: true })).inScope).toBe(false);
  });
});
