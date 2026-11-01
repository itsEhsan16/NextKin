import type { FormatFacts, ScoringDocument } from '@nextkin/engines/document';
import type { ScoreResult, SectionCheckId } from '@nextkin/engines/rubric';

import type { AtsCheckItem, AtsReport, AtsSection } from '../models/resume';

/**
 * The score panel's checklist (RESUMES 04's Content / Format / Keywords / Best practices), written
 * from the engine's result so every line is a check the number actually rests on. Lint never
 * appears here: it suggests and never scores (P8-08).
 *
 * `fixable` is true only where the product may make the change itself: a skill the profile backs.
 * A gap is shown and never inserted; a missing figure is the user's to supply (V2 §7.8, C-10).
 */

export const FORMAT_LABEL: Record<keyof FormatFacts, string> = {
  singleColumn: 'Single column',
  standardHeadings: 'Standard section headings',
  noTablesOrImages: 'No tables, text boxes or images',
  standardFonts: 'Standard fonts',
  contactInBody: 'Contact details in the body',
  consistentDates: 'Dates written the same way',
};

const SECTION_LABEL: Record<SectionCheckId, string> = {
  summary: 'Summary of 15 words or more',
  skills: 'Three or more skills listed',
  experience_dates: 'Every role has its dates',
  education: 'Education listed',
  contact: 'Contact details complete',
};

export { summaryFor } from '../models/resume';

const pass = (id: string, label: string, passed: boolean): AtsCheckItem => ({ id, label, passed });

export function checklistFor(result: ScoreResult, report: AtsReport, doc: ScoringDocument): AtsSection[] {
  const sectionChecks = result.components.find((c) => c.key === 'sections')?.checks ?? [];
  const sectionPassed = (id: SectionCheckId) => sectionChecks.find((c) => c.id === id)?.passed ?? false;
  const achievements = result.components.find((c) => c.key === 'achievements')!.basis;

  const askFixes = report.fixes.filter((f) => f.type === 'ask_for_number');
  const content: AtsCheckItem[] = [
    pass('quantified', `Measured outcomes in ${achievements.quantified} of ${achievements.bullets} bullets`, askFixes.length === 0 && (achievements.bullets ?? 0) > 0),
    ...askFixes.map((fix) => {
      const role = doc.roles.find((r) => r.id === fix.roleId);
      const index = Number(fix.id.split(':').at(-1));
      const bullet = role?.bullets[index];
      return {
        id: `num:${fix.roleId}`,
        label: `A bullet in your ${role?.company ?? ''} role has no measured outcome`.replace('  ', ' '),
        passed: false,
        fixable: false,
        ...(bullet ? { suggestion: `Add the real figure to "${bullet}"` } : {}),
        section: 'experience' as const,
        fixId: fix.id,
        ...(fix.basis ? { basis: fix.basis } : {}),
      };
    }),
    pass('summary', SECTION_LABEL.summary, sectionPassed('summary')),
    pass('skills', SECTION_LABEL.skills, sectionPassed('skills')),
  ];

  const formatChecks = result.components.find((c) => c.key === 'formatting')?.checks ?? [];
  const format = formatChecks.map((c) => pass(`fmt:${c.id}`, FORMAT_LABEL[c.id as keyof FormatFacts], c.passed));

  const sections: AtsSection[] = [
    { key: 'content', label: 'Content', items: content },
    { key: 'format', label: 'Format', items: format },
  ];

  if (report.jdMatch) {
    const keywords: AtsCheckItem[] = [];
    for (const req of report.requirements) {
      if (req.status === 'eligibility') continue;
      const fix = report.fixes.find((f) => f.requirementId === req.id && f.type === 'surface_backed_skill');
      const id = `kw:${req.id.replace(/^req:/, '')}`;
      const base = { id, keyword: req.text };
      if (req.status === 'met') {
        keywords.push({ ...base, label: `"${req.text}" shown in your experience`, passed: true });
      } else if (fix) {
        keywords.push({
          ...base,
          label: req.status === 'gap' ? `Missing: "${req.text}"` : `"${req.text}" is listed, but no dated role shows it`,
          passed: false,
          fixable: true,
          supported: true,
          suggestion: fix.section === 'experience' ? `Add "${req.text}" to the role your profile shows it in` : `Add "${req.text}" to your skills`,
          section: fix.section ?? 'skills',
          fixId: fix.id,
          ...(fix.basis ? { basis: fix.basis } : {}),
        });
      } else if (req.status === 'partial' && req.years) {
        keywords.push({ ...base, label: `"${req.text}": ${req.years.shown} of ${req.years.asked}+ years shown`, passed: false, fixable: false });
      } else if (req.status === 'partial') {
        keywords.push({ ...base, label: `"${req.text}" is listed, but no dated role shows it`, passed: false, fixable: false });
      } else {
        const gap = report.fixes.find((f) => f.requirementId === req.id && f.type === 'gap');
        keywords.push({ ...base, label: `"${req.text}" is not in your profile`, passed: false, fixable: false, supported: false, ...(gap?.basis ? { basis: gap.basis } : {}) });
      }
    }
    sections.push({ key: 'keywords', label: 'Keywords', items: keywords });
  }

  sections.push({
    key: 'best',
    label: 'Best practices',
    items: (['experience_dates', 'education', 'contact'] as const).map((id) => pass(id, SECTION_LABEL[id], sectionPassed(id))),
  });

  const conflicts = report.timeline.flags.filter((f) => f.verdict !== 'unverified');
  if (conflicts.length > 0) {
    sections.push({
      key: 'timeline',
      label: 'Timeline',
      items: conflicts.map((flag) => ({
        id: `tl:${flag.roleId}:${flag.skill}`,
        label: `"${flag.skill}" ${flag.reason}`,
        passed: false,
        fixable: false,
        ...(flag.substitutions.length ? { suggestion: `Instead, if true: ${flag.substitutions.join(', ')}` } : {}),
        section: 'experience' as const,
      })),
    });
  }
  return sections;
}

