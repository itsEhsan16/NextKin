import { SEPARATOR, type RenderBlock, type RenderModel, type RenderSection } from './model';

/**
 * Export templates (ImBackendImplementationPlan P10-04, P10-12; V2 §7.12). A template is trusted
 * HTML and CSS; user content is escaped into it. Pages render with JavaScript off and the network
 * blocked: the only things a page can load are the bundled fonts, served by the renderer from
 * `assets/fonts` under FONT_ORIGIN.
 *
 * Until the designer's launch set exists there is one real template, NextKin Classic: the single
 * column the apps already print, in Liberation Sans (metric-compatible with Arial, which the DOCX
 * declares). `two-column-test` is never offered: it exists so certification can prove it rejects a
 * multi-column body (P10-06).
 */

export const FONT_ORIGIN = 'https://fonts.nextkin.invalid';

export interface ExportTemplate {
  slug: string;
  name: string;
  /** Claimed by the design: single column, standard fonts, no tables, images or text boxes. */
  atsSafe: boolean;
  /** Offered to users; the test template never is. */
  offered: boolean;
  html(model: RenderModel): string;
}

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const FONTS = `
@font-face{font-family:'Liberation Sans';font-weight:400;font-style:normal;src:url(${FONT_ORIGIN}/LiberationSans-Regular.ttf) format('truetype')}
@font-face{font-family:'Liberation Sans';font-weight:700;font-style:normal;src:url(${FONT_ORIGIN}/LiberationSans-Bold.ttf) format('truetype')}
@font-face{font-family:'Liberation Sans';font-weight:400;font-style:italic;src:url(${FONT_ORIGIN}/LiberationSans-Italic.ttf) format('truetype')}`;

// No letter-spacing or text-transform: both change what a parser reads out of the PDF.
const BASE = `${FONTS}
@page{size:A4;margin:16mm 17mm}
html{-webkit-print-color-adjust:exact}
body{margin:0;font-family:'Liberation Sans',sans-serif;font-size:10.5pt;line-height:1.4;color:#111827}
h1{font-size:19pt;line-height:1.15;margin:0 0 2pt;font-weight:700}
.headline{font-size:11pt;font-weight:700;margin:0 0 2pt}
.contact{color:#374151;margin:0 0 6pt}
h2{font-size:11pt;font-weight:700;margin:12pt 0 4pt;padding-bottom:2pt;border-bottom:0.75pt solid #9ca3af;color:#111827}
p{margin:0 0 5pt}
.entry{margin:0 0 7pt;break-inside:avoid}
.entry-title{font-weight:700;margin:0}
.entry-meta{color:#374151;margin:0 0 2pt}
ul{margin:2pt 0 0;padding-left:14pt}
li{margin:0 0 2pt}`;

function block(b: RenderBlock): string {
  if (b.kind === 'paragraph') return `<p>${escape(b.text)}</p>`;
  const bullets = b.bullets.length ? `<ul>${b.bullets.map((t) => `<li>${escape(t)}</li>`).join('')}</ul>` : '';
  const subtitle = b.subtitle ? `<p class="entry-title">${escape(b.subtitle)}</p>` : '';
  return `<div class="entry"><p class="entry-title">${escape(b.title)}</p>${subtitle}${b.meta ? `<p class="entry-meta">${escape(b.meta)}</p>` : ''}${bullets}</div>`;
}

const section = (s: RenderSection) => `<section>${s.heading ? `<h2>${escape(s.heading)}</h2>` : ''}${s.blocks.map(block).join('')}</section>`;

const header = (m: RenderModel) =>
  `<header><h1>${escape(m.name)}</h1>${m.headline ? `<p class="headline">${escape(m.headline)}</p>` : ''}${m.contact.length ? `<p class="contact">${m.contact.map(escape).join(SEPARATOR)}</p>` : ''}</header>`;

const page = (m: RenderModel, style: string, body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(m.name)}</title><style>${style}</style></head><body>${body}</body></html>`;

export const CLASSIC: ExportTemplate = {
  slug: 'nextkin-classic',
  name: 'NextKin Classic',
  atsSafe: true,
  offered: true,
  html: (m) => page(m, BASE, `${header(m)}<main>${m.sections.map(section).join('')}</main>`),
};

/** Deliberately not ATS-safe: summary and experience beside contact, skills and education. */
export const TWO_COLUMN_TEST: ExportTemplate = {
  slug: 'two-column-test',
  name: 'Two-column (certification test only)',
  atsSafe: false,
  offered: false,
  html: (m) => {
    const side = new Set(['Skills', 'Education', 'Certifications']);
    const left = m.sections.filter((s) => side.has(s.heading));
    const right = m.sections.filter((s) => !side.has(s.heading));
    const style = `${BASE}\n.cols{display:grid;grid-template-columns:34% 1fr;column-gap:14pt}`;
    return page(m, style, `${header(m)}<div class="cols"><aside>${left.map(section).join('')}</aside><main>${right.map(section).join('')}</main></div>`);
  },
};

export const TEMPLATES: Record<string, ExportTemplate> = { [CLASSIC.slug]: CLASSIC, [TWO_COLUMN_TEST.slug]: TWO_COLUMN_TEST };
export const DEFAULT_TEMPLATE = CLASSIC.slug;
