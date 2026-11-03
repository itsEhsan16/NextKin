import type { ResumeTemplateId } from '@nextkin/shared/models/resumeDocument';

/**
 * The resume templates as LaTeX (toreview §124). A template changes only the fixed preamble — the
 * font, the section heading, the name and headline macros, the contact separator and the header's
 * alignment — so every template sets the same body, the lint checks it the same way, and every one
 * stays a single column of real text (ATS-safe by design). Fonts load by file name from the TeX
 * bundle, so the compile image's warm-up must compile each template once (`warmupSources.ts`).
 *
 * `rev` names the template's output: bump it when a template's TeX changes, so its renders are
 * made again rather than reused.
 */

export interface LatexStyle {
  slug: ResumeTemplateId;
  rev: number;
  /** The preamble's first line. */
  banner: string;
  /** Regular and bold only: two faces of one standard font (toreview §130). */
  font: { regular: string; options: string[] };
  /** The standard font the file is (or matches the metrics of), for the score's font check. */
  fontName: string;
  /** Packages and definitions after enumitem, before hyperref. */
  packages: string[];
  sectionFormat: string;
  sep: string;
  name: string;
  headline: string;
  /** The environment the header is set in, and its definition when it is the template's own. */
  headerEnv: 'center' | 'rheader';
  headerEnvironment: string[];
}

const JAKE: LatexStyle = {
  slug: 'jake',
  // Raised for toreview §168: renders that failed while the AWS demo's Tectonic could not run are
  // made again under this revision.
  rev: 4,
  banner: `% Classic: Jake's Resume layout (github.com/jakegut/resume, MIT), set for XeTeX/Tectonic in Lato.`,
  font: {
    regular: 'Lato-Regular.ttf',
    options: ['Ligatures={TeX,NoCommon}', 'BoldFont=Lato-Bold.ttf'],
  },
  fontName: 'Lato',
  packages: [],
  sectionFormat: '\\titleformat{\\section}{\\bfseries\\raggedright\\large}{}{0em}{}[\\titlerule]',
  sep: ' | ',
  name: '{\\fontsize{22pt}{26pt}\\selectfont\\bfseries #1\\par}\\vspace{4pt}',
  headline: '{#1\\par}\\vspace{2pt}',
  headerEnv: 'center',
  headerEnvironment: [],
};

const MODERN: LatexStyle = {
  slug: 'modern',
  // Raised for toreview §168: renders that failed while the AWS demo's Tectonic could not run are
  // made again under this revision.
  rev: 3,
  banner: '% NextKin Modern: one column in Roboto, name on the left, indigo headings.',
  font: {
    regular: 'Roboto-Regular.otf',
    options: ['Ligatures={TeX,NoCommon}', 'BoldFont=Roboto-Bold.otf'],
  },
  fontName: 'Roboto',
  packages: ['\\usepackage{xcolor}', '\\definecolor{rAccent}{HTML}{4338CA}', '\\definecolor{rRule}{HTML}{C7D2FE}'],
  sectionFormat: '\\titleformat{\\section}{\\color{rAccent}\\bfseries\\large}{}{0em}{}[{\\color{rRule}\\titlerule[0.8pt]}]',
  sep: ' | ',
  name: '{\\fontsize{24pt}{28pt}\\selectfont\\bfseries #1\\par}\\vspace{3pt}',
  headline: '{\\color{rAccent}\\normalsize #1\\par}\\vspace{3pt}',
  headerEnv: 'rheader',
  headerEnvironment: ['\\newenvironment{rheader}{\\par\\raggedright}{\\par\\vspace{4pt}}'],
};

const ELEGANT: LatexStyle = {
  slug: 'elegant',
  // Raised for toreview §168: renders that failed while the AWS demo's Tectonic could not run are
  // made again under this revision.
  rev: 3,
  banner: '% NextKin Elegant: one column in TeX Gyre Termes (Times New Roman metrics), centred name.',
  font: {
    regular: 'texgyretermes-regular.otf',
    options: ['Ligatures={TeX,NoCommon}', 'BoldFont=texgyretermes-bold.otf'],
  },
  fontName: 'Times New Roman',
  packages: [],
  sectionFormat: '\\titleformat{\\section}{\\large\\bfseries}{}{0em}{}[{\\vspace{1pt}\\titlerule[0.4pt]}]',
  sep: ' | ',
  name: '{\\fontsize{22pt}{26pt}\\selectfont\\bfseries #1\\par}\\vspace{4pt}',
  headline: '{#1\\par}\\vspace{3pt}',
  headerEnv: 'center',
  headerEnvironment: [],
};

export const LATEX_STYLES: Record<ResumeTemplateId, LatexStyle> = { jake: JAKE, modern: MODERN, elegant: ELEGANT };

/** The style a stored resume names, Classic when it names none (or one no longer offered). */
export const styleOf = (template: string | undefined): LatexStyle => LATEX_STYLES[(template ?? 'jake') as ResumeTemplateId] ?? JAKE;
