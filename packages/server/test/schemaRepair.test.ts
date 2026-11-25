import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { repairToSchema, strictJsonSchema } from '../src/ai/schema';
import { extractionSchema } from '../src/parsing/extract';

// toreview §269: a tool answer with a small slip failed the schema twice and the upload was refused.
const json = strictJsonSchema(extractionSchema);
const role = (over: Record<string, unknown> = {}) => ({ company: 'Acme', title: 'Engineer', start: '2021-03', end: null, current: true, skills: [], summary: null, bullets: ['Built things'], entries: [], ...over });
const base = (over: Record<string, unknown> = {}) => ({ headline: null, summary: null, roles: [role()], education: [], certifications: [], projects: [], skills: ['React'], skillGroups: [], extraSections: [], sectionOrder: ['Experience'], ...over });

describe('repairToSchema on the resume extraction', () => {
  it('leaves a valid answer exactly as it is', () => {
    const answer = base();
    expect(repairToSchema(json, answer)).toEqual(answer);
    expect(extractionSchema.safeParse(repairToSchema(json, answer)).success).toBe(true);
  });

  it('parses a list the model sent as a JSON string', () => {
    const answer = base({ roles: JSON.stringify([role()]) });
    expect(extractionSchema.safeParse(answer).success).toBe(false);
    const fixed = extractionSchema.parse(repairToSchema(json, answer));
    expect(fixed.roles[0]?.company).toBe('Acme');
  });

  it('keeps the month of a full date and nulls a word where a date may be null', () => {
    const answer = base({ roles: [role({ start: '2021-03-15', end: 'Present', current: 'true' })] });
    const fixed = extractionSchema.parse(repairToSchema(json, answer));
    expect(fixed.roles[0]).toMatchObject({ start: '2021-03', end: null, current: true });
  });

  it('cuts lists past their cap instead of refusing the whole resume', () => {
    const answer = base({ extraSections: Array.from({ length: 7 }, (_, i) => ({ heading: `S${i}`, entries: [], lines: ['x'] })), sectionOrder: Array.from({ length: 20 }, (_, i) => `H${i}`) });
    const fixed = extractionSchema.parse(repairToSchema(json, answer));
    expect(fixed.extraSections).toHaveLength(4);
    expect(fixed.sectionOrder).toHaveLength(16);
  });

  it('leaves out a list item missing a required value, keeping the rest', () => {
    const answer = base({ roles: [role({ company: '' }), role({ company: 'Beta' })], skills: ['React', ''] });
    const fixed = extractionSchema.parse(repairToSchema(json, answer));
    expect(fixed.roles.map((r) => r.company)).toEqual(['Beta']);
    expect(fixed.skills).toEqual(['React']);
  });

  it('reads a field left out as none', () => {
    const answer: Record<string, unknown> = base();
    delete answer.certifications;
    delete answer.headline;
    const fixed = extractionSchema.parse(repairToSchema(json, answer));
    expect(fixed).toMatchObject({ certifications: [], headline: null });
  });

  it('returns the answer unchanged when nothing can mend it, so the schema still refuses', () => {
    const tiny = z.object({ name: z.string().min(1) });
    const answer = { name: '' };
    expect(repairToSchema(strictJsonSchema(tiny), answer)).toEqual(answer);
    expect(repairToSchema(json, undefined)).toBeUndefined();
  });
});
