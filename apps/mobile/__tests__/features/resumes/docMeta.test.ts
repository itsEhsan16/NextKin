import type { Resume } from '@/data/models';
import { atsBandColor, atsScoreColor, docPillLabel, docSubtitle, scoreContextLine } from '@/features/resumes';

const doc = (overrides: Partial<Resume>): Resume => ({
  id: 'res_x',
  title: 'Doc',
  docType: 'resume',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
  versionCount: 1,
  currentVersionId: 'ver_x_1',
  status: 'ready',
  tags: [],
  ...overrides,
});

describe('docPillLabel / docSubtitle (RESUMES 01/02 card copy)', () => {
  it('labels the base resume "Base" with the artboard subtitle', () => {
    const base = doc({ title: 'Product Designer', isBase: true, pageCount: 3 });
    expect(docPillLabel(base)).toBe('Base');
    expect(docSubtitle(base)).toBe('Base resume · 3 pages · PDF and DOCX ready');
  });

  it('labels tailored docs with their company', () => {
    const tailored = doc({
      title: 'Stripe — Senior PD',
      targetCompany: 'Stripe',
      targetRole: 'Senior Product Designer',
    });
    expect(docPillLabel(tailored)).toBe('Tailored · Stripe');
    expect(docSubtitle(tailored)).toBe('Tailored · Stripe · Senior Product Designer');
  });

  it('labels cover letters as their own type', () => {
    const cover = doc({
      title: 'Stripe cover letter',
      docType: 'cover_letter',
      targetCompany: 'Stripe',
      targetRole: 'Senior Product Designer',
    });
    expect(docPillLabel(cover)).toBe('Cover letter');
    expect(docSubtitle(cover)).toBe('Cover letter · Stripe · Senior Product Designer');
  });
});

describe('ATS band colours (RESUMES 01 arc tints)', () => {
  it('maps strong to green, good to amber, the rest to red', () => {
    expect(atsBandColor('strong')).toBe('success');
    expect(atsBandColor('good')).toBe('warningAccent');
    expect(atsBandColor('fair')).toBe('danger');
    expect(atsBandColor('weak')).toBe('danger');
  });

  it('agrees with the band thresholds when keyed off the raw score', () => {
    expect(atsScoreColor(92)).toBe('success');
    expect(atsScoreColor(84)).toBe('warningAccent');
    expect(atsScoreColor(69)).toBe('danger');
  });
});

describe('scoreContextLine (RESUMES 04, 1:2121)', () => {
  it('spells the artboard line for the base resume', () => {
    expect(scoreContextLine(doc({ title: 'Product Designer', isBase: true }))).toBe(
      'Product Designer — Base · recalculates as you edit',
    );
  });

  it('marks tailored docs as tailored', () => {
    expect(scoreContextLine(doc({ title: 'Stripe — Senior PD' }))).toBe(
      'Stripe — Senior PD — Tailored · recalculates as you edit',
    );
  });
});
