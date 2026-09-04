import { atsBandFor, type AtsBand, type Resume } from '@/data/models';
import { pluralize } from '@/lib';
import type { ColorToken } from '@/theme';

/** The document-type pill's three looks (Figma 1:1422 / 1:1450 / 1:1496). */
export type DocPillTone = 'base' | 'tailored' | 'cover';

export function docPillTone(resume: Resume): DocPillTone {
  if (resume.docType === 'cover_letter') return 'cover';
  return resume.isBase ? 'base' : 'tailored';
}

/** "Base" · "Tailored · Stripe" · "Cover letter" — the pill copy under every card. */
export function docPillLabel(resume: Resume): string {
  if (resume.docType === 'cover_letter') return 'Cover letter';
  if (resume.isBase) return 'Base';
  return resume.targetCompany ? `Tailored · ${resume.targetCompany}` : 'Tailored';
}

/**
 * The list row's second line (Figma 1:1632 / 1:1654 / 1:1697):
 * "Base resume · 3 pages · PDF and DOCX ready" / "Tailored · Stripe · Senior Product Designer".
 */
export function docSubtitle(resume: Resume): string {
  if (resume.docType === 'cover_letter') {
    return ['Cover letter', resume.targetCompany, resume.targetRole].filter(Boolean).join(' · ');
  }
  if (resume.isBase) {
    return [
      'Base resume',
      resume.pageCount != null ? pluralize(resume.pageCount, 'page') : undefined,
      'PDF and DOCX ready',
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return ['Tailored', resume.targetCompany, resume.targetRole].filter(Boolean).join(' · ');
}

/**
 * Arc colour by band (RESUMES 01 draws 92/88 green, 84/81/76 amber, 69 red). `fair` and `weak`
 * share the red — the artboard has no fourth colour.
 */
export function atsBandColor(band: AtsBand): ColorToken {
  if (band === 'strong') return 'success';
  if (band === 'good') return 'warningAccent';
  return 'danger';
}

/** Same mapping keyed off the raw 0–100 value, for spots that only have the number. */
export function atsScoreColor(score: number): ColorToken {
  return atsBandColor(atsBandFor(score));
}

/** "Product Designer — Base · recalculates as you edit" (Figma 1:2121). */
export function scoreContextLine(resume: Resume): string {
  const kind =
    resume.docType === 'cover_letter' ? 'Cover letter' : resume.isBase ? 'Base' : 'Tailored';
  return `${resume.title} — ${kind} · recalculates as you edit`;
}
