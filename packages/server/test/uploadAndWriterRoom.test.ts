import { describe, expect, it } from 'vitest';

import { createAiGateway } from '../src/ai/gateway';
import { createFakeProvider } from '../src/ai/providers/fake';
import { toParams, withoutThinking } from '../src/ai/providers/messages';
import { type AiSettings, type RouteStep } from '../src/ai/routing';
import { createMemoryTrace } from '../src/ai/trace';
import type { LlmRequest } from '../src/ai/types';
import { createLogger } from '../src/observability/logger';
import { analyzeDocx, xmlText } from '../src/parsing/docx';
import { crossCheck, extractionSchema, type ExtractionInput } from '../src/parsing/extract';
import { makeDocx } from './fixtures/makeDocx';

/**
 * Owner, 2026-11-25. One resume failed at three places: its long summary was left out on upload, a
 * DOCX's "&" arrived as "&amp;" and cost it its skills, and the writer spent its whole answer
 * allowance thinking and wrote nothing. Synthetic text throughout (L4).
 */

const log = createLogger('silent', 'test');

describe('an answer that ran out of room', () => {
  it('is asked again with twice the room and no thinking', async () => {
    const fake = createFakeProvider({ script: (_request, n) => (n === 1 ? { stopReason: 'max_tokens' } : { text: 'the answer' }) });
    const step: RouteStep = { provider: 'claude', model: 'claude-sonnet-5-5', maxTokens: 100, inputBudgetTokens: 1000 };
    const settings: AiSettings = { routeFor: async () => [step], prices: async () => ({ version: 1, models: {} }) };
    const gw = createAiGateway({ settings, providers: { resolve: () => fake, isDeveloperKey: () => false }, trace: createMemoryTrace(), log, developer: 'd', dailyCapUsd: 2, retryDelayMs: () => 0 });
    const { text } = await gw.generate({ stage: 's', system: [{ text: 'Be brief.' }], input: { role: 'Engineer' }, context: { userId: 'u1', generationId: 'g1' } });
    expect(text).toBe('the answer');
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls.at(-1)).toMatchObject({ maxTokens: 200, thinking: 'off' });
  });

  it('a route may set the effort and turn thinking off itself', async () => {
    const fake = createFakeProvider();
    const step: RouteStep = { provider: 'claude', model: 'claude-sonnet-5-5', maxTokens: 100, inputBudgetTokens: 1000, effort: 'medium', thinking: 'off' };
    const settings: AiSettings = { routeFor: async () => [step], prices: async () => ({ version: 1, models: {} }) };
    const gw = createAiGateway({ settings, providers: { resolve: () => fake, isDeveloperKey: () => false }, trace: createMemoryTrace(), log, developer: 'd', dailyCapUsd: 2, retryDelayMs: () => 0 });
    await gw.generate({ stage: 's', system: [{ text: 'Be brief.' }], input: { role: 'Engineer' }, context: { userId: 'u1', generationId: 'g1' } });
    expect(fake.calls[0]).toMatchObject({ effort: 'medium', thinking: 'off' });
  });
});

describe('what the request says about thinking and effort', () => {
  const request = (patch: Partial<LlmRequest>): LlmRequest => ({ model: 'claude-sonnet-5-5', maxTokens: 100, system: [{ text: 's' }], messages: [{ role: 'user', content: 'hi' }], ...patch });
  const sent = (patch: Partial<LlmRequest>) => toParams(request(patch)) as unknown as { thinking?: unknown; output_config?: unknown };

  it('nothing, unless asked: the model’s own defaults stand', () => {
    expect(sent({})).not.toHaveProperty('thinking');
    expect(sent({})).not.toHaveProperty('output_config');
  });

  it('effort goes in output_config', () => {
    expect(sent({ effort: 'low' }).output_config).toEqual({ effort: 'low' });
  });

  it('thinking off is said the way each model takes it', () => {
    expect(sent({ thinking: 'off' }).thinking).toEqual({ type: 'between_tools' });
    expect(sent({ thinking: 'off', model: 'claude-haiku-5-5' }).thinking).toEqual({ type: 'disabled' });
    expect(sent({ thinking: 'off', model: 'us.anthropic.claude-sonnet-5-5' }).thinking).toEqual({ type: 'between_tools' });
    // A model that cannot answer without thinking is sent nothing it would refuse.
    expect(sent({ thinking: 'off', model: 'claude-opus-5-5' })).not.toHaveProperty('thinking');
    expect(withoutThinking('claude-fable-5-2')).toBeNull();
  });
});

describe('the characters of a DOCX', () => {
  it('reads "&" as "&", and the other built-in entities and numeric references', () => {
    expect(xmlText('Cloud Platforms &amp; Infrastructure')).toBe('Cloud Platforms & Infrastructure');
    expect(xmlText('a &lt; b &gt; c &quot;q&quot; &apos;s&apos; &#233;t&#xE9;')).toBe('a < b > c "q" \'s\' été');
    // What the author typed as "&lt;" stays those four characters; an unknown entity is left alone.
    expect(xmlText('&amp;lt; &nbsp; &#0; &#xD800;')).toBe('&lt; &nbsp; &#0; &#xD800;');
  });

  it('a skills line with an ampersand in its label arrives as written', () => {
    const text = analyzeDocx(makeDocx([[{ text: 'Technical Skills' }], [{ text: 'Cloud Platforms & Infrastructure: AWS, Docker' }], [{ text: 'R&D lead for C++ & Go services' }]])).text;
    expect(text).toContain('Cloud Platforms & Infrastructure: AWS, Docker');
    expect(text).toContain('R&D lead for C++ & Go services');
    expect(text).not.toContain('&amp;');
  });
});

describe('what an upload keeps', () => {
  const LINES = Array.from({ length: 12 }, (_, i) => `Line ${i + 1} of the summary: eight years building backend services and RESTful APIs for payment platforms, with clear ownership of delivery, quality and production support.`);
  const SOURCE = ['Jordan Avery', 'Professional Summary', ...LINES, 'Technical Skills', 'Cloud Platforms & Infrastructure: AWS, Docker, Kubernetes', 'Backend Development: Java, Spring Boot', 'Experience', 'Northwind Logistics - Senior Platform Engineer', 'March 2021 - Present', 'Built pipelines with Kubernetes and Terraform.'].join('\n');
  const extraction = (patch: Partial<ExtractionInput> = {}) =>
    extractionSchema.parse({
      headline: null,
      summary: LINES.join('\n'),
      roles: [{ company: 'Northwind Logistics', title: 'Senior Platform Engineer', start: '2021-03', end: null, current: true, skills: [], summary: null, bullets: ['Built pipelines with Kubernetes and Terraform.'] }],
      education: [],
      certifications: [],
      skills: [],
      skillGroups: [
        { label: 'Cloud Platforms & Infrastructure', skills: ['AWS', 'Docker', 'Kubernetes'] },
        { label: 'Backend Development', skills: ['Java', 'Spring Boot', 'Rust'] },
      ],
      ...patch,
    });

  it('a summary of a dozen lines, whole', () => {
    const { document, rejected } = crossCheck(extraction(), SOURCE);
    expect(LINES.join('\n').length).toBeGreaterThan(1800);
    expect(document.summary?.text).toBe(LINES.join('\n'));
    expect(rejected.filter((r) => r.section === 'summary')).toEqual([]);
  });

  it('the lines of a summary the file states, when one was reworded', () => {
    const reworded = [...LINES.slice(0, 3), 'A sentence the file never says.', ...LINES.slice(3, 5)].join('\n');
    const { document, rejected } = crossCheck(extraction({ summary: reworded }), SOURCE);
    expect(document.summary?.text).toBe(LINES.slice(0, 5).join('\n'));
    expect(rejected.find((r) => r.section === 'summary')?.reason).toMatch(/Part of the summary/);
  });

  it('no summary the file does not state, and a line too long says so', () => {
    const none = crossCheck(extraction({ summary: 'Invented from nothing at all.' }), SOURCE);
    expect(none.document.summary).toBeUndefined();
    const long = `Built pipelines with Kubernetes and Terraform. ${'x'.repeat(700)}`;
    const { rejected } = crossCheck(extraction({ roles: [{ company: 'Northwind Logistics', title: 'Senior Platform Engineer', start: '2021-03', end: null, current: true, skills: [], summary: null, bullets: [long] }] }), `${SOURCE}\n${long}`);
    expect(rejected.find((r) => r.section === 'experience')?.reason).toMatch(/longer than 600 characters/);
  });

  it('the skills its skill lines name, when the list itself came back empty', () => {
    const { document, draft, rejected } = crossCheck(extraction(), SOURCE);
    expect(document.skills.map((s) => s.name)).toEqual(['AWS', 'Docker', 'Kubernetes', 'Java', 'Spring Boot']);
    expect(document.skillGroups).toEqual([
      { label: 'Cloud Platforms & Infrastructure', names: ['AWS', 'Docker', 'Kubernetes'] },
      { label: 'Backend Development', names: ['Java', 'Spring Boot'] },
    ]);
    expect(draft.skills).toEqual(['AWS', 'Docker', 'Kubernetes', 'Java', 'Spring Boot']);
    // "Rust" is on no line of the file: it is on neither list.
    expect(rejected.some((r) => r.section === 'skills' && /label/.test(r.reason))).toBe(false);
  });

  it('each skill once, when the list and a line both name it', () => {
    const { document } = crossCheck(extraction({ skills: ['Docker', 'Java'] }), SOURCE);
    expect(document.skills.map((s) => s.name)).toEqual(['Docker', 'Java', 'AWS', 'Kubernetes', 'Spring Boot']);
  });
});
