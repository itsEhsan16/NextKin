import { canonicalResumeSchema } from '@nextkin/shared/schemas/resumeContent';
import { describe, expect, it } from 'vitest';
import { fitDocument, isEmptyResume } from '../src/parsing/fitDocument';

// toreview §269: a resume that read fine was refused at import because its document broke the format.
const line = (id: string) => ({ id, text: `Line ${id}`, evidence: [], origin: 'user' as const });
const role = { roleId: 'upload-r0', company: 'Acme', title: 'Engineer', start: '2021-03', end: null, skills: [], bullets: [line('b0')] };
const doc = (over: Record<string, unknown> = {}) => ({ schemaVersion: 1, skills: [], roles: [role], education: [], certifications: [], projects: [], ...over });

describe('fitDocument', () => {
  it('passes a document that already fits, untouched', () => {
    const result = fitDocument(doc());
    expect(result).toMatchObject({ ok: true, repaired: false });
  });

  it('trims a document past the format’s limits instead of refusing it', () => {
    const header = { name: 'Sam', items: Array.from({ length: 15 }, (_, i) => ({ text: `link ${i}` })) };
    const sections = Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, heading: `Section ${i}`, entries: [], lines: [line(`l${i}`)] }));
    const bullets = Array.from({ length: 16 }, (_, i) => line(`b${i}`));
    const input = doc({ header, sections, roles: [{ ...role, bullets }] });
    expect(canonicalResumeSchema.safeParse(input).success).toBe(false);
    const result = fitDocument(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.repaired).toBe(true);
    expect(result.doc.header?.items).toHaveLength(12);
    expect(result.doc.sections).toHaveLength(6);
    expect(result.doc.roles[0]?.bullets).toHaveLength(12);
  });

  it('says what still fails when it cannot be mended', () => {
    const result = fitDocument({ schemaVersion: 2 });
    expect(result.ok).toBe(false);
  });

  it('knows a document with no role, school or project is empty, summary or not', () => {
    const result = fitDocument(doc({ roles: [] }));
    expect(result.ok && isEmptyResume(result.doc)).toBe(true);
  });
});
