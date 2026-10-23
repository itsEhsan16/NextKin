import type { ResumeContent } from '../models';

/**
 * About how many pages a resume runs to (toreview §110): the tailor comparison's Length row and
 * the review's "about 3 pages → about 2". An estimate, and labelled one: no render happens here.
 * A line budget a one-column template holds, counted the same way every time: headings, wrapped
 * text at an average line length, and each entry's header lines.
 */
const CHARS_PER_LINE = 95;
const LINES_PER_PAGE = 50;
const HEADER_LINES = 4;
const SECTION_HEADING_LINES = 2;

const wrapped = (text: string) =>
  text.trim() ? Math.ceil(text.trim().length / CHARS_PER_LINE) : 0;

export function estimateLines(content: ResumeContent): number {
  let lines = HEADER_LINES;
  if (content.summary.trim()) lines += SECTION_HEADING_LINES + wrapped(content.summary);
  if (content.skills.length) lines += SECTION_HEADING_LINES + wrapped(content.skills.join(' · '));
  if (content.experience.length) {
    lines += SECTION_HEADING_LINES;
    for (const role of content.experience)
      lines += 2 + role.bullets.reduce((n, b) => n + wrapped(b), 0) + 1;
  }
  if (content.projects.length) {
    lines += SECTION_HEADING_LINES;
    for (const p of content.projects)
      lines += 1 + wrapped(p.description) + p.bullets.reduce((n, b) => n + wrapped(b), 0) + 1;
  }
  if (content.education.length) lines += SECTION_HEADING_LINES + content.education.length * 2;
  if (content.certifications.length) lines += SECTION_HEADING_LINES + content.certifications.length;
  return lines;
}

/** Whole pages, at least one. */
export const estimatePages = (content: ResumeContent): number =>
  Math.max(1, Math.ceil(estimateLines(content) / LINES_PER_PAGE));
