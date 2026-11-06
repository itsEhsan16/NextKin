import { figureLine } from '@nextkin/shared/models/tailor';
import { describe, expect, it } from 'vitest';

import { fallbackDraft, fitsSuggestion, keepsToLine } from '../src/services/figureDraft';

/** "Add the result", drafted (toreview §129): the AI may only make room for the user's figure. */

const LINE = 'Built the checkout in Next.js and TypeScript for the customer and admin apps.';

describe('figure drafts', () => {
  it('accepts a draft that keeps the line and leaves the figure to the user', () => {
    expect(keepsToLine(LINE, { before: 'Built the checkout in Next.js and TypeScript for the customer and admin apps, cutting page load time by', after: '.' })).toBe(true);
  });

  it('rejects a number, a technology or a different claim the line never made', () => {
    expect(keepsToLine(LINE, { before: 'Built the checkout in Next.js and TypeScript, cutting load time by 40% for', after: '.' })).toBe(false);
    expect(keepsToLine(LINE, { before: 'Built the checkout in Next.js, TypeScript and GraphQL for the customer and admin apps, serving', after: '.' })).toBe(false);
    expect(keepsToLine(LINE, { before: 'Led a team that shipped payments, growing revenue by', after: '.' })).toBe(false);
  });

  it('falls back to the line with the gap after "improving", and the figure reads into it', () => {
    const draft = fallbackDraft(LINE);
    expect(draft).toMatchObject({ before: 'Built the checkout in Next.js and TypeScript for the customer and admin apps, improving', after: '.', by: 'rules' });
    expect(figureLine(draft, 'page load time by 30%')).toBe('Built the checkout in Next.js and TypeScript for the customer and admin apps, improving page load time by 30%.');
    expect(figureLine({ before: 'Served', after: ' shops a month.' }, ' 12,000 ')).toBe('Served 12,000 shops a month.');
  });

  it('keeps a suggestion only when it is a short figure (toreview §173)', () => {
    expect(fitsSuggestion('about 20%')).toBe(true);
    expect(fitsSuggestion('5,000 users')).toBe(true);
    expect(fitsSuggestion(null)).toBe(false);
    expect(fitsSuggestion('faster')).toBe(false);
    expect(fitsSuggestion('20% by moving the checkout to GraphQL')).toBe(false);
    expect(fitsSuggestion('40% with Kubernetes')).toBe(false);
  });
});
