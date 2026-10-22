import type { AtsCheckFix, AtsCheckResult, JdDraft, Resume } from '../models';
import { TAILOR_TARGET_PAGES } from '../models';
import type { DocumentScore } from './report';

/**
 * The ATS check (V2 §7.8, toreview §73): a resume measured against one job. The number, the
 * missing skills and the fixes all come from the one engine run that scored the document
 * (C-10), so ATS 03, the library card and the score panel cannot disagree. Shared by the mock and
 * the server (P9), which read it off the same engine result.
 */

/** "Fix these" shows the three most useful changes; the rest wait for the next check. */
const MAX_FIXES = 3;

const FIX_COPY = {
  columns: { title: 'Use one column', detail: 'Some systems read two columns out of order.' },
  summary: { title: 'Add a short summary', detail: 'Two or three lines on your strongest work.' },
  length: { title: 'Keep it to two pages', detail: 'Recruiters skim one or two.' },
} as const;

const fix = (key: keyof typeof FIX_COPY): AtsCheckFix => ({ key, ...FIX_COPY[key] });

/**
 * The check's result, read off the engine run. Undefined when the job named no skill the engines
 * could read: then there is no total to report (D-15), and the run keeps no check result.
 */
export function atsCheckFrom(args: {
  result: DocumentScore;
  resume: Pick<Resume, 'pageCount'>;
  draft: Pick<JdDraft, 'title' | 'company'>;
}): AtsCheckResult | undefined {
  const { result, resume, draft } = args;
  const score = result.score;
  if (!score) return undefined;
  const report = result.report;

  const fixes: AtsCheckFix[] = [];
  if (report.fixes.some((f) => f.type === 'formatting' && f.id === 'format:singleColumn')) fixes.push(fix('columns'));
  if (report.fixes.some((f) => f.type === 'complete_section' && f.id === 'section:summary')) fixes.push(fix('summary'));
  if (report.fixes.some((f) => f.type === 'ask_for_number')) {
    const basis = report.components.find((c) => c.key === 'achievements')?.basis ?? '';
    fixes.push({ key: 'results', title: 'Show results in your bullets', detail: `${basis}.` });
  }
  // Advisory: length is lint, not part of the score (P8-08).
  if (resume.pageCount != null && resume.pageCount > TAILOR_TARGET_PAGES) fixes.push(fix('length'));

  const company = draft.company?.trim() || undefined;
  const jobTitle = draft.title?.trim() || undefined;
  return {
    score: score.total,
    band: score.band,
    missing: report.requirements.filter((r) => r.status === 'gap' || r.status === 'partial').map((r) => r.text),
    fixes: fixes.slice(0, MAX_FIXES),
    ...(company ? { company } : {}),
    ...(jobTitle ? { jobTitle } : {}),
  };
}
