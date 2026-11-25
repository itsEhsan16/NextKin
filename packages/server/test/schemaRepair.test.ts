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

// Owner, 2026-11-25: a resume whose long summary swallowed the job history. Every upload of that
// file read as a resume with no jobs and was refused as "no resume in this file".
describe('a text field that swallowed the fields after it', () => {
  const roles = [role({ company: 'Northgate Health', bullets: ['Built the claims service'] }), role({ company: 'Brightleaf', start: '2019-08', end: '2022-11', current: false })];
  const swallowed = (after = '') => {
    const rest: Record<string, unknown> = base({ summary: `Eight years building backend services.">\n<parameter name="roles">${JSON.stringify(roles)}${after}` });
    delete rest.roles;
    return rest;
  };

  it('gives each swallowed field back, parsed, and the text its own value', () => {
    const answer = swallowed();
    expect(extractionSchema.safeParse(answer).success).toBe(false);
    const fixed = extractionSchema.parse(repairToSchema(json, answer));
    expect(fixed.summary).toBe('Eight years building backend services.');
    expect(fixed.roles.map((r) => r.company)).toEqual(['Northgate Health', 'Brightleaf']);
    expect(fixed.roles[0]?.bullets).toEqual(['Built the claims service']);
  });

  it('reads several swallowed fields, with or without their closing tags', () => {
    const answer = swallowed(`</parameter>\n<parameter name="skills">["Java","Kotlin"]</parameter>`);
    const withoutSkills = { ...answer };
    delete withoutSkills.skills;
    const fixed = extractionSchema.parse(repairToSchema(json, withoutSkills));
    expect(fixed.roles).toHaveLength(2);
    expect(fixed.skills).toEqual(['Java', 'Kotlin']);
  });

  it('never overwrites a field the answer already has, or one the schema does not name', () => {
    const kept = [role({ company: 'Sent Properly' })];
    const answer = { ...swallowed(`</parameter>\n<parameter name="salary">"100k"`), roles: kept };
    const fixed = repairToSchema(json, answer) as { roles: unknown; summary: string; salary?: unknown };
    expect(fixed.roles).toEqual(kept);
    expect(fixed.salary).toBeUndefined();
    // Nothing was taken out of the text, so the text is left as it came.
    expect(fixed.summary).toContain('<parameter name="roles">');
  });

  it('leaves ordinary text alone, angle brackets and all', () => {
    const answer = base({ summary: 'Wrote <parameter> docs and a List<String> helper; score > 90.' });
    expect(repairToSchema(json, answer)).toEqual(answer);
  });
});
