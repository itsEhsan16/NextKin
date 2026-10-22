import { preambleOf } from './jakeTemplate';
import { LATEX_STYLES } from './styles';
import type { LatexDensity, LatexResume } from './types';

/**
 * Proves a generated .tex source holds only what the template emits (toreview §111), before it
 * goes to the compile service:
 *  - the preamble is byte-for-byte one of the templates' own (style × density 0/1/2 × letter/a4);
 *  - the body (after \begin{document}) uses only the control sequences and environments below,
 *    every \href url matches the shape `texUrl` produces, braces balance, and the source ends at
 *    \end{document};
 *  - none of TeX's other specials appear raw in the body (`$ & # % ^ _ ~`, control characters), and
 *    `[`/`]` appear only as `{[}`/`{]}`, so nothing can open math, a comment, an alignment, a
 *    `^^` character code or an optional argument.
 */

/** Control words the body may contain: the template's macros, then texText's escapes. */
export const BODY_WORDS: ReadonlySet<string> = new Set([
  'begin', 'end', 'section', 'item', 'textbf', 'par', 'href',
  'rName', 'rHeadline', 'rSep', 'rPara', 'rTech', 'rHead', 'rHeadSub',
  'textbackslash', 'textasciicircum', 'textasciitilde',
]);
/** Control symbols (backslash + one non-letter) the body may contain: texText's escapes. */
export const BODY_SYMBOLS: ReadonlySet<string> = new Set(['{', '}', '$', '&', '#', '%', '_']);
export const BODY_ENVIRONMENTS: ReadonlySet<string> = new Set(['document', 'center', 'rheader', 'rentries', 'rbullets', 'rlines']);

/** Named so a refusal says what it is; all of them are refused anyway as not allowlisted. */
const DANGEROUS = /^(input|include|includeonly|InputIfFileExists|openin|openout|read|readline|write|immediate|csname|endcsname|catcode|lccode|uccode|def|edef|gdef|xdef|let|futurelet|newcommand|renewcommand|providecommand|DeclareRobustCommand|usepackage|RequirePackage|documentclass|special|directlua|latelua|expandafter|noexpand|scantokens|everypar|everyjob|jobname|shipout|output|errmessage|message|endinput|XeTeX\w*|pdf\w*)$/;

const RAW_FORBIDDEN = /[$&#%^_~]/;
const CONTROL_CHAR = new RegExp('[\\u0000-\\u0009\\u000B-\\u001F\\u007F-\\u009F\\u2028\\u2029]');
/** The url argument texUrl writes: an allowed scheme, safe characters, `\%XX` escapes. */
export const HREF_URL_RE = /^(?:https:\/\/|mailto:|tel:)(?:[A-Za-z0-9\-.:/?=+,;@!'()*]|\\%[0-9A-F]{2})*$/;

const PAPERS: LatexResume['paper'][] = ['letter', 'a4'];
const DENSITIES: LatexDensity[] = [0, 1, 2];

function isLetter(c: string): boolean {
  return /^[A-Za-z]$/.test(c);
}

export function lintTex(source: string): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const preamble = Object.values(LATEX_STYLES)
    .flatMap((style) => DENSITIES.flatMap((d) => PAPERS.map((p) => preambleOf(d, p, style))))
    .find((p) => source.startsWith(p));
  if (preamble === undefined) return { ok: false, problems: ['the preamble is not one of the template preambles'] };
  const body = source.slice(preamble.length);
  const end = '\\end{document}\n';
  if (!body.endsWith(end) || body.indexOf('\\end{document}') !== body.length - end.length) problems.push('the source must end at its only \\end{document}');

  let depth = 0;
  let i = 0;
  while (i < body.length) {
    const c = body[i] ?? '';
    if (c === '\\') {
      const next = body[i + 1] ?? '';
      if (!isLetter(next)) {
        if (!BODY_SYMBOLS.has(next)) problems.push(`control symbol \\${next} at ${i}`);
        i += 2;
        continue;
      }
      let j = i + 1;
      while (j < body.length && isLetter(body[j] ?? '')) j++;
      const name = body.slice(i + 1, j);
      if (DANGEROUS.test(name)) problems.push(`forbidden control sequence \\${name} at ${i}`);
      else if (!BODY_WORDS.has(name)) problems.push(`control sequence \\${name} is not in the template at ${i}`);
      if (name === 'begin' || name === 'end') {
        const m = /^\{([A-Za-z*]+)\}/.exec(body.slice(j));
        const env = m?.[1] ?? '';
        if (!BODY_ENVIRONMENTS.has(env) || (name === 'begin' && env === 'document')) problems.push(`environment at ${i} is not in the template`);
        j += m ? m[0].length : 0;
      } else if (name === 'href') {
        const close = body.indexOf('}', j);
        const url = body[j] === '{' && close > j ? body.slice(j + 1, close) : null;
        if (url === null || !HREF_URL_RE.test(url)) problems.push(`\\href url at ${i} is not one texUrl writes`);
        else j = close + 1;
      }
      i = j;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && --depth < 0) {
      problems.push(`unbalanced } at ${i}`);
      depth = 0;
    } else if (c === '[' || c === ']') {
      if (body[i - 1] !== '{' || body[i + 1] !== '}') problems.push(`raw ${c} at ${i}`);
    } else if (RAW_FORBIDDEN.test(c)) problems.push(`raw ${c} at ${i}`);
    else if (CONTROL_CHAR.test(c)) problems.push(`control character U+${c.charCodeAt(0).toString(16).padStart(4, '0')} at ${i}`);
    i++;
  }
  if (depth !== 0) problems.push('unbalanced {');
  return { ok: problems.length === 0, problems };
}
