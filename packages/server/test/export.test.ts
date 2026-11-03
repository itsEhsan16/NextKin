import { MARKETS } from '@nextkin/engines/markets';
import { describe, expect, it } from 'vitest';

import { CERTIFICATION_RESUME } from '../src/export/certify';
import { exportFileName, expectedLines, marketPeriod, resumeModel } from '../src/export/model';
import { compareWithModel, parseBack, receiptOf } from '../src/export/parseBack';
import { renderDocx } from '../src/export/renderDocx';
import { fixPdfDates } from '../src/export/renderPdf';
import { renderTxt } from '../src/export/renderTxt';
import { CLASSIC } from '../src/export/templates';
import { factsInResume } from '../src/pipeline/stages/kinds';

/** The export pieces that need no browser (P10-04…P10-06, P10-09); Chromium is the integration suite's. */

const MODEL = resumeModel(CERTIFICATION_RESUME, { name: 'Alex Example', email: 'alex@example.com' });

describe('the render model', () => {
  it('uses the conventional headings in §7.12’s order, and market date formats (Q-07)', () => {
    expect(MODEL.sections.map((s) => s.heading)).toEqual(['Summary', 'Skills', 'Work Experience', 'Projects', 'Certifications', 'Education']);
    expect(marketPeriod('2021-03', null, MARKETS.profiles.us)).toBe('Mar 2021 – Present');
    expect(marketPeriod('2021-03', '2023-11', MARKETS.profiles.de)).toBe('03/2021 – 11/2023');
    expect(marketPeriod('2014', '2018', MARKETS.profiles.de)).toBe('2014 – 2018');
  });

  it('names files FirstName_LastName_JobTitle, with anything unsafe collapsed away', () => {
    expect(exportFileName('Jane Müller', 'Senior Engineer / Payments', 'pdf')).toBe('Jane_Muller_Senior_Engineer_Payments.pdf');
    expect(exportFileName('', '', 'txt')).toBe('Resume.txt');
  });

  it('escapes user content into the template', () => {
    const html = CLASSIC.html({ ...MODEL, name: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('parse-back (Q-06)', () => {
  it('TXT and DOCX read back with every line, in order', async () => {
    expect(await parseBack(MODEL, 'txt', renderTxt(MODEL))).toMatchObject({ ok: true, missing: [], outOfOrder: [] });
    expect(await parseBack(MODEL, 'docx', await renderDocx(MODEL))).toMatchObject({ ok: true, missing: [], outOfOrder: [] });
  });

  it('reports a lost line, a broken order, and the sections they belong to', () => {
    const lines = expectedLines(MODEL);
    const summary = lines[lines.indexOf('Summary') + 1]!;
    const dropped = compareWithModel(MODEL, lines.filter((l) => l !== summary).join('\n'));
    expect(dropped).toMatchObject({ ok: false, missing: [summary], sectionsLost: ['Summary'] });
    const swapped = [...lines];
    const a = swapped.indexOf('Skills');
    const b = swapped.indexOf('Education');
    [swapped[a], swapped[b]] = [swapped[b]!, swapped[a]!];
    expect(compareWithModel(MODEL, swapped.join('\n')).ok).toBe(false);
  });

  it('ignores spacing, case and bullet glyphs, never words', () => {
    const text = expectedLines(MODEL).map((l) => `• ${l.toUpperCase().replace(/ /g, '  ')}`).join('\n');
    expect(compareWithModel(MODEL, text).ok).toBe(true);
  });
});

describe('the export receipt (toreview §146.6)', () => {
  const text = new TextDecoder().decode(renderTxt(MODEL));
  const bullets = MODEL.sections.flatMap((s) => s.blocks.flatMap((b) => (b.kind === 'entry' ? b.bullets : [])));

  it('counts every section and bullet of a file that reads back whole', () => {
    expect(bullets.length).toBeGreaterThan(0);
    expect(receiptOf(MODEL, text)).toEqual({
      sections: { found: MODEL.sections.length, total: MODEL.sections.length },
      bullets: { found: bullets.length, total: bullets.length },
    });
  });

  it('counts a bullet that didn’t, and the section it sits in', () => {
    const lost = bullets[0]!;
    const receipt = receiptOf(MODEL, text.replace(lost, ''));
    expect(receipt.bullets).toEqual({ found: bullets.length - 1, total: bullets.length });
    expect(receipt.sections.found).toBe(MODEL.sections.length - 1);
  });

  it('isn’t thrown by what a typesetter does: a hyphen at a line’s end, curled quotes', () => {
    const lost = bullets[0]!;
    const middle = Math.floor(lost.length / 2);
    const hyphenated = `${lost.slice(0, middle)}-${String.fromCharCode(10)}${lost.slice(middle)}`.replace(/'/g, '’');
    expect(receiptOf(MODEL, text.replace(lost, hyphenated)).bullets.found).toBe(bullets.length);
  });

  it('counts a skill wherever the file set it', () => {
    const skills = MODEL.sections.find((s) => s.heading === 'Skills')?.blocks[0];
    if (skills?.kind !== 'paragraph') throw new Error('expected a skills line');
    const grouped = skills.text.split(', ').map((skill) => `Tools: ${skill}`).join(String.fromCharCode(10));
    expect(receiptOf(MODEL, text.replace(skills.text, grouped)).sections.found).toBe(MODEL.sections.length);
  });
});

describe('byte-identical PDFs', () => {
  it('replaces Chromium’s render time with the stamp, keeping every byte offset', () => {
    const raw = new TextEncoder().encode("1 0 obj\n<< /CreationDate (D:20261012093011+00'00') /ModDate (D:20261012093011+00'00') >>\nxref 42");
    const fixed = fixPdfDates(raw, new Date('2026-01-02T03:04:05Z'));
    const text = new TextDecoder().decode(fixed);
    expect(fixed.length).toBe(raw.length);
    expect(text).toContain("/CreationDate (D:20260102030405+00'00')");
    expect(text).toContain("/ModDate (D:20260102030405+00'00')");
  });
});

describe('a cover letter’s facts (P10-09)', () => {
  it('keeps only what the source resume shows, with fact ids unchanged', () => {
    const facts = {
      summary: 'Payments engineer.',
      skills: ['Go', 'PostgreSQL', 'Cobol'],
      roles: [
        { id: 'r1', company: 'Acme Pay', title: 'Senior Backend Engineer', start: { year: 2021, month: 3 }, end: null, description: 'Owns settlement.', responsibilities: ['Built the ledger', 'Cut latency by 40%'], skills: ['Go'] },
        { id: 'r9', company: 'Elsewhere', title: 'Intern', start: { year: 2010 }, end: { year: 2011 }, responsibilities: ['Wrote reports'], skills: ['Cobol'] },
      ],
      education: [],
      certifications: [],
      projects: [],
    };
    const doc = { ...CERTIFICATION_RESUME, summary: undefined, skills: [{ id: 'k0', name: 'Go', evidence: ['r1'], origin: 'generated' as const }], roles: [{ ...CERTIFICATION_RESUME.roles[0]!, roleId: 'r1', skills: ['Go'], bullets: [{ id: 'b0', text: 'Cut latency by 40%.', evidence: ['r1#r1'], origin: 'generated' as const }] }], certifications: [], education: [], projects: [] };
    const kept = factsInResume(facts, doc);
    expect(kept.roles.map((r) => r.id)).toEqual(['r1']);
    expect(kept.roles[0]!.responsibilities).toEqual(['', 'Cut latency by 40%']);
    expect(kept.roles[0]!.description).toBeUndefined();
    expect(kept.skills).toEqual(['Go']);
    expect(kept.summary).toBeUndefined();
  });
});
