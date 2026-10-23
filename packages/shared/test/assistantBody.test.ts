import { describe, expect, it } from 'vitest';

import { greetingAnswer } from '../src/assistant/answers';
import { buildAssistantContext } from '../src/assistant/context';
import { BODY_LIMITS, documentBody } from '../src/assistant/documentBody';
import { greetingKind } from '../src/assistant/domain';
import type { Resume, ResumeContent } from '../src/models';
import { redactLinks, redactNames, redactPersonal } from '../src/privacy/contact';

/** The assistant's view of a document (toreview §109): its text, never its contact block. */

const content: ResumeContent = {
  kind: 'resume',
  resumeId: 'res_1',
  versionId: 'v1',
  headline: 'Backend Engineer',
  contact: { email: 'ana.lima@example.com', phone: '+49 30 1234567', location: 'Berlin' },
  summary: 'Ana Lima builds payment systems. Portfolio at https://ana.dev/work.',
  skills: ['Go', 'PostgreSQL', 'Node.js'],
  experience: [
    {
      id: 'r1',
      company: 'Lumen Pay',
      title: 'Senior Backend Engineer',
      period: 'Mar 2020 — Present',
      location: 'Berlin, Germany',
      skills: ['Go'],
      bullets: [
        'Built the settlement service in Go, processing 2 million transactions daily',
        'Mail ana.lima@example.com or call +49 30 1234567',
      ],
    },
  ],
  projects: [
    { id: 'p1', name: 'Ledger', description: 'See github.com/analima/ledger', bullets: [] },
  ],
  certifications: ['AWS Certified Developer'],
  education: [
    { id: 'e1', institution: 'TU Berlin', degree: 'BSc Computer Science', period: '2012 — 2016' },
  ],
  links: ['https://linkedin.com/in/analima'],
};

const redact = (text: string) => redactPersonal(text, ['Ana', 'Lima']);

describe('the document body', () => {
  it('copies the text and drops the contact block', () => {
    const body = documentBody(content, redact);
    const all = JSON.stringify(body);
    expect(body.roles[0]).toMatchObject({
      company: 'Lumen Pay',
      title: 'Senior Backend Engineer',
      location: 'Berlin, Germany',
    });
    expect(body.roles[0]!.bullets[0]).toBe(
      'Built the settlement service in Go, processing 2 million transactions daily',
    );
    expect(body.skills).toEqual(['Go', 'PostgreSQL', 'Node.js']);
    // Nothing contact-shaped survives, wherever it was written.
    expect(all).not.toMatch(/@|linkedin|ana\.dev|\+49|Lima|\bAna\b/i);
    expect(body.summary).toBe('[name] [name] builds payment systems. Portfolio at [link].');
    expect(body.roles[0]!.bullets[1]).toBe('Mail [email] or call [phone]');
    expect(body.projects[0]!.description).toBe('See [link]');
  });

  it('keeps to the budget, dropping the oldest roles first', () => {
    const role = (i: number) => ({
      ...content.experience[0]!,
      id: `r${i}`,
      company: `Company ${i}`,
      bullets: Array.from({ length: 12 }, () => 'x'.repeat(500)),
    });
    const big: ResumeContent = {
      ...content,
      experience: Array.from({ length: 20 }, (_, i) => role(i)),
    };
    const body = documentBody(big, (t) => t);
    expect(body.roles.length).toBeLessThanOrEqual(BODY_LIMITS.roles);
    expect(JSON.stringify(body).length).toBeLessThanOrEqual(BODY_LIMITS.totalChars);
    expect(body.roles[0]!.company).toBe('Company 0');
    expect(body.roles[0]!.bullets.length).toBe(BODY_LIMITS.bulletsPerRole);
    expect(body.roles[0]!.bullets[0]!.length).toBeLessThanOrEqual(BODY_LIMITS.bulletChars);
  });

  it('is never set by the shared builder, so the mock and the phone see section names only', () => {
    const resume = { id: 'res_1', title: 'Backend', docType: 'resume' } as Resume;
    expect(buildAssistantContext({ resume, content })).not.toHaveProperty('body');
  });
});

describe('redaction', () => {
  it('leaves dotted skill names and dates alone', () => {
    expect(redactLinks('Node.js, ASP.NET and Socket.io since 2019-2021')).toBe(
      'Node.js, ASP.NET and Socket.io since 2019-2021',
    );
    expect(redactLinks('www.example.org and gitlab.com/ana')).toBe('[link] and [link]');
  });
  it('replaces whole-word names only', () => {
    expect(redactNames('Anabel met Ana', ['Ana'])).toBe('Anabel met [name]');
    expect(redactNames('No names here', [null, '', 'A'])).toBe('No names here');
  });
});

describe('greetings', () => {
  it('reads a bare greeting or thanks, and nothing more', () => {
    for (const text of [
      'Hi',
      'hi!',
      'Hello there',
      'Good morning',
      'hey nextkin',
      'Guten Morgen',
      'Hallo',
    ])
      expect(greetingKind(text)).toBe('hello');
    for (const text of ['Thanks!', 'thank you so much', 'Danke', 'cheers'])
      expect(greetingKind(text)).toBe('thanks');
    for (const text of [
      'Hi, write my essay',
      'Hi can you check my resume',
      'How do I explain a gap?',
      '',
      'hello hello hello hello hello hello hello',
    ])
      expect(greetingKind(text)).toBeNull();
  });
  it('answers with what the assistant can do, and the open document', () => {
    expect(greetingAnswer('hello')).toMatch(
      /^Hi! I’m NextKin’s career assistant\. I can help with/,
    );
    const context = buildAssistantContext({
      resume: { id: 'r', title: 'Backend Resume', docType: 'resume' } as Resume,
    });
    expect(greetingAnswer('thanks', context)).toContain('**Backend Resume** open');
  });
});
