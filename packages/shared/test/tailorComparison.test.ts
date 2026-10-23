import { describe, expect, it } from 'vitest';

import type { DocumentScore } from '../src/scoring/report';
import { improvementsFor, jobMatchOf, keywordsFrom, markTop, quoteOf } from '../src/scoring/tailorComparison';
import { yearsAskedOf, yearsRow } from '../src/scoring/yearsAsked';

/**
 * W-TAILOR 01's rows say what was measured, and how (toreview §110.6): a keyword only listed is
 * part credit and shows as such; the layout row is the file's when it was measured, the template's
 * when it is NextKin's; the summary row says it is a text check.
 */

const scored = (requirements: unknown[]) => ({ report: { requirements } }) as unknown as DocumentScore;

describe('keywordsFrom', () => {
  it('marks how each keyword is shown, full matches first, and drops eligibility lines', () => {
    const keywords = keywordsFrom(
      scored([
        { text: 'HTML5', importance: 'required', status: 'partial', evidence: 'listed' },
        { text: 'Vue', importance: 'required', status: 'gap', evidence: 'unbacked' },
        { text: 'React', importance: 'required', status: 'met', evidence: 'demonstrated' },
        { text: 'Go', importance: 'preferred', status: 'partial', evidence: 'demonstrated', years: { asked: 5, shown: 2 } },
        { text: 'A degree', importance: 'required', status: 'eligibility', evidence: null },
      ]),
    );
    expect(keywords).toEqual([
      // Four keywords are all within the top ten.
      { label: 'React', onResume: true, shown: 'experience', source: 'required', top: true },
      { label: 'Go', onResume: true, shown: 'fewer_years', source: 'description', top: true },
      { label: 'HTML5', onResume: true, shown: 'listed', source: 'required', top: true },
      { label: 'Vue', onResume: false, source: 'required', top: true },
    ]);
  });
});

describe('improvementsFor', () => {
  const base = { headline: 'Frontend developer', summary: 'Builds fast web apps.', target: { title: 'Frontend Developer', company: 'Coral Finance' } };
  const row = (rows: ReturnType<typeof improvementsFor>, key: string) => rows.find((r) => r.key === key)!;

  it('reads the layout off the file when it was measured, and says what it found', () => {
    const clean = row(improvementsFor({ ...base, layout: { from: 'file', ok: true, found: [] } }), 'layout');
    expect(clean).toMatchObject({ ok: true, detail: expect.stringMatching(/^Checked in your file/) });
    const columns = row(improvementsFor({ ...base, layout: { from: 'file', ok: false, found: ['text in two or more columns', 'a picture'] } }), 'layout');
    expect(columns).toEqual({ key: 'layout', label: 'Layout', ok: false, detail: 'Your file has text in two or more columns and a picture. The tailored resume downloads in a one-column ATS layout.' });
  });

  it('a NextKin document’s layout is its template’s, said as such', () => {
    expect(row(improvementsFor({ ...base, layout: { from: 'template' } }), 'layout').detail).toMatch(/NextKin’s one-column template/);
  });

  it('the summary row says what it checks: whether it names the title or the company', () => {
    expect(row(improvementsFor(base), 'summary')).toMatchObject({ ok: false, detail: 'Names neither this job’s title nor the company.' });
    expect(row(improvementsFor({ ...base, writtenFor: 'Product Designer' }), 'summary').detail).toBe('Written for Product Designer roles; it names neither this title nor the company.');
    expect(row(improvementsFor({ ...base, summary: 'Frontend Developer who ships.' }), 'summary')).toMatchObject({ ok: true, detail: 'Names this role or the company.' });
  });

  it('a page count read from the file is not called an estimate', () => {
    expect(row(improvementsFor({ ...base, pages: 1 }), 'length').detail).toBe('1 page. Easy to skim.');
    expect(row(improvementsFor({ ...base, pages: 2, pagesEstimated: true }), 'length').detail).toBe('About 2 pages. Easy to skim.');
  });
});

describe('the JD line and the job match (toreview §112)', () => {
  const RAW = 'Frontend Development\nBuild and enhance user interfaces using HTML, CSS, JavaScript.\nCustomer onboarding & KYC journeys,';

  it('quotes the line that names a keyword as whole words', () => {
    expect(quoteOf(RAW, 'KYC')).toBe('Customer onboarding & KYC journeys,');
    expect(quoteOf(RAW, 'user interfaces')).toBe('Build and enhance user interfaces using HTML, CSS, JavaScript.');
    expect(quoteOf(RAW, 'Java')).toBeUndefined();
  });

  it('counts the keywords shown anywhere, and lists the missing ones', () => {
    const match = jobMatchOf([
      { label: 'React', onResume: true, source: 'required' },
      { label: 'HTML', onResume: true, shown: 'listed', source: 'required' },
      { label: 'KYC', onResume: false, source: 'description' },
    ]);
    expect(match).toMatchObject({ matched: 2, total: 3, percent: 67, missing: ['KYC'] });
    expect(match?.basis).toMatch(/^2 of this job’s 3 most important keywords/);
    expect(jobMatchOf([])).toBeUndefined();
  });
});

describe('the top keywords, years and soft skills (toreview §113)', () => {
  it('ranks required first, then the title, then how often the JD says it; the match counts only those', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ label: `Skill${i}`, onResume: i % 2 === 0, source: (i < 3 ? 'required' : 'description') as 'required' | 'description' }));
    const raw = 'Skill11 and Skill11 again, Skill11.';
    const marked = markTop([...many, { label: 'teamwork', onResume: false, source: 'description', kind: 'soft' }], raw, 'Skill10 Developer');
    const top = marked.filter((k) => k.top).map((k) => k.label);
    expect(top).toHaveLength(10);
    // The title's and the most-said skill outrank the rest of the preferred ones; the last two by order go.
    expect(top).toEqual(expect.arrayContaining(['Skill0', 'Skill1', 'Skill2', 'Skill10', 'Skill11']));
    expect(top).not.toContain('Skill8');
    expect(top).not.toContain('Skill9');
    expect(top).not.toContain('teamwork');
    expect(jobMatchOf(marked)?.total).toBe(10);
  });

  it('reads the years a JD asks for and says what the resume shows', () => {
    expect(yearsAskedOf('0–2 years exp, New Grad')).toEqual({ min: 0, max: 2 });
    expect(yearsAskedOf('You have 3+ years in React')).toEqual({ min: 3 });
    expect(yearsAskedOf('Build user interfaces', 'entry')).toEqual({ min: 0, max: 2 });
    expect(yearsAskedOf('Build user interfaces')).toBeNull();
    expect(yearsRow({ min: 0, max: 2 }, 3)).toMatchObject({ ok: true, detail: 'This job asks for 0–2 years; your resume shows under a year of dated experience.' });
    expect(yearsRow({ min: 5 }, 24).ok).toBe(false);
  });
});
