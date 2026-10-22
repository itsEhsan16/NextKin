import { texText, texUrl } from './escape';
import { LATEX_STYLES, type LatexStyle } from './styles';
import type { LatexDensity, LatexEntry, LatexResume, LatexSection } from './types';

/**
 * The resume layout (after Jake's Resume, github.com/jakegut/resume, MIT) as XeTeX source for
 * Tectonic 0.17 (toreview §111). Bold name, one contact line joined by " | ", bold section headings
 * over a rule, entries as a bold title with dates flush right over a subtitle with the place flush
 * right, tight bullets.
 *
 * ATS formatting (owner, toreview §130): no tables (a line's right part is pushed flush right with
 * filll glue, so the text reads left to right), only regular and bold faces of one standard font,
 * body text 10pt or larger, margins of at least half an inch on every side, left aligned, nothing
 * in a header or footer, one plain separator.
 *
 * The preamble is fixed per (density, paper) and is the only place macros are defined; the body
 * uses only the macros below plus `texText`'s escapes, which `texLint.ts` checks. Packages:
 * fontspec, geometry, titlesec, enumitem, hyperref. Fonts are loaded by file name from the TeX
 * bundle (`styles.ts`), which Tectonic resolves without fontconfig.
 */

interface Rung {
  /** The body size, set at \begin{document}: never under 10pt (toreview §130). */
  body: string;
  margins: string;
  sectionBefore: string;
  sectionAfter: string;
  /** Between bullets. */
  itemSep: string;
  /** Above and below a bullet list. */
  listTop: string;
  /** Between entries. */
  entrySep: string;
}

const RUNGS: Record<LatexDensity, Rung> = {
  0: { body: '\\fontsize{10.5pt}{12.8pt}\\selectfont', margins: 'margin=0.6in', sectionBefore: '8pt', sectionAfter: '4pt', itemSep: '1pt', listTop: '2pt', entrySep: '4pt' },
  1: { body: '\\fontsize{10pt}{12.2pt}\\selectfont', margins: 'margin=0.5in', sectionBefore: '6pt', sectionAfter: '3pt', itemSep: '0.5pt', listTop: '1.5pt', entrySep: '3pt' },
  2: { body: '\\fontsize{10pt}{11.8pt}\\selectfont', margins: 'margin=0.5in', sectionBefore: '5pt', sectionAfter: '2pt', itemSep: '0pt', listTop: '1pt', entrySep: '2pt' },
};

/** Nesting depth of entries: a role and its client projects. Deeper children join the last level. */
const MAX_NEST = 2;

/** The fixed preamble, up to and including `\begin{document}` and its newline. */
export function preambleOf(density: LatexDensity, paper: LatexResume['paper'], style: LatexStyle = LATEX_STYLES.jake): string {
  const r = RUNGS[density];
  const paperOpt = paper === 'a4' ? 'a4paper' : 'letterpaper';
  return [
    style.banner,
    `\\documentclass[${paperOpt},11pt]{article}`,
    `\\usepackage[${paperOpt},${r.margins}]{geometry}`,
    '\\usepackage{fontspec}',
    `\\setmainfont{${style.font.regular}}[${style.font.options.join(',')}]`,
    '\\usepackage{titlesec}',
    '\\usepackage{enumitem}',
    ...style.packages,
    '\\usepackage[hidelinks]{hyperref}',
    '\\urlstyle{same}',
    // ATS text extraction: no hyphenation, so every word is whole in the text layer. Interword
    // space shaping stays off: mode 2 drops every link after the first (toreview §111.4).
    '\\hyphenpenalty=10000',
    '\\exhyphenpenalty=10000',
    '\\pagestyle{empty}',
    '\\raggedbottom',
    '\\raggedright',
    '\\setlength{\\parindent}{0pt}',
    style.sectionFormat,
    `\\titlespacing*{\\section}{0pt}{${r.sectionBefore}}{${r.sectionAfter}}`,
    '\\newlist{rentries}{itemize}{3}',
    `\\setlist[rentries]{label={},leftmargin=0.15in,topsep=0pt,partopsep=0pt,parsep=0pt,itemsep=${r.entrySep}}`,
    '\\newlist{rbullets}{itemize}{3}',
    `\\setlist[rbullets]{label={\\textbullet},leftmargin=0.15in,topsep=${r.listTop},partopsep=0pt,parsep=0pt,itemsep=${r.itemSep}}`,
    '\\newlist{rlines}{itemize}{3}',
    `\\setlist[rlines]{label={},leftmargin=0.15in,topsep=0pt,partopsep=0pt,parsep=0pt,itemsep=${r.itemSep}}`,
    `\\newcommand{\\rSep}{${style.sep}}`,
    `\\newcommand{\\rName}[1]{${style.name}}`,
    `\\newcommand{\\rHeadline}[1]{${style.headline}}`,
    ...style.headerEnvironment,
    '\\newcommand{\\rPara}[1]{{#1\\par}}',
    '\\newcommand{\\rTech}[1]{{#1\\par}}',
    // No table (toreview §130): filll glue outranks \raggedright's fil, so the right part sits flush
    // right on the same line and the text layer reads it after the left part.
    '\\newcommand{\\rRight}{\\hspace{0pt plus 1filll}}',
    '\\newcommand{\\rHead}[2]{{#1\\rRight #2\\par}}',
    '\\newcommand{\\rHeadSub}[4]{{#1\\rRight #2\\par}{#3\\rRight #4\\par}}',
    `\\AtBeginDocument{${r.body}}`,
    '\\begin{document}',
    '',
  ].join('\n');
}

function has(s: string | undefined): s is string {
  return s !== undefined && texText(s) !== '';
}

function headerOf(resume: LatexResume, style: LatexStyle): string[] {
  const out = [`\\begin{${style.headerEnv}}`, `\\rName{${texText(resume.name)}}`];
  if (has(resume.headline)) out.push(`\\rHeadline{${texText(resume.headline)}}`);
  const items = resume.contact.filter((c) => has(c.text)).map((c) => {
    const url = c.url === undefined ? null : texUrl(c.url);
    return url === null ? texText(c.text) : `\\href{${url}}{${texText(c.text)}}`;
  });
  // Top level, never inside a macro argument, so \href reads its url with its own catcodes.
  if (items.length) out.push(`{${items.join('\\rSep ')}\\par}`);
  out.push(`\\end{${style.headerEnv}}`);
  return out;
}

function entryItem(entry: LatexEntry, depth: number): string[] {
  let title = `\\textbf{${texText(entry.title)}}`;
  if (has(entry.titleNote)) title += ` ${texText(entry.titleNote)}`;
  const inlineTech = entry.techInline === true && has(entry.tech);
  if (inlineTech) title += `\\rSep ${texText(entry.tech ?? '')}`;
  const right = texText(entry.right ?? '');
  const subText = texText(entry.subtitle ?? '');
  // A job title is bold like the employer (toreview §130); a degree or a description is not.
  const sub = subText && entry.subtitleBold ? `\\textbf{${subText}}` : subText;
  const subRight = texText(entry.subRight ?? '');
  const out = [sub || subRight ? `\\item \\rHeadSub{${title}}{${right}}{${sub}}{${subRight}}` : `\\item \\rHead{${title}}{${right}}`];
  if (!inlineTech && has(entry.tech)) out.push(`\\rTech{${texText(entry.tech)}}`);
  const bullets = entry.bullets.filter(has);
  if (bullets.length) out.push('\\begin{rbullets}', ...bullets.map((b) => `\\item ${texText(b)}`), '\\end{rbullets}');
  const children = entry.children ?? [];
  if (children.length === 0) return out;
  const childItems = children.flatMap((child) => entryItem(child, Math.min(depth + 1, MAX_NEST)));
  return depth < MAX_NEST ? [...out, '\\begin{rentries}', ...childItems, '\\end{rentries}'] : [...out, ...childItems];
}

function sectionOf(section: LatexSection): string[] {
  const out = [`\\section*{${texText(section.heading)}}`];
  if (section.kind === 'paragraph') {
    if (has(section.text)) out.push(`\\rPara{${texText(section.text)}}`);
    return out;
  }
  if (section.kind === 'lines') {
    const lines = section.lines.filter((l) => has(l.text) || has(l.label));
    if (lines.length === 0) return out;
    const items = lines.map((l) => (has(l.label) ? `\\item \\textbf{${texText(l.label)}}: ${texText(l.text)}` : `\\item ${texText(l.text)}`));
    return [...out, '\\begin{rlines}', ...items, '\\end{rlines}'];
  }
  if (section.entries.length === 0) return out;
  return [...out, '\\begin{rentries}', ...section.entries.flatMap((e) => entryItem(e, 1)), '\\end{rentries}'];
}

/** The complete .tex document for `resume`. Every user string goes through texText or texUrl. */
export function texOf(resume: LatexResume, style: LatexStyle = LATEX_STYLES.jake): string {
  const body = [...headerOf(resume, style), ...resume.sections.flatMap(sectionOf), '\\end{document}', ''];
  return preambleOf(resume.density, resume.paper, style) + body.join('\n');
}
