/**
 * Escaping for the LaTeX resume (toreview §111). Every user string reaches the .tex source only
 * through `texText`, every link only through `texUrl`; `texLint.ts` proves the result.
 *
 * Choices, so the integrator knows what the PDF shows:
 *  - The ten TeX specials are escaped to text symbols: \ { } $ & # % _ ^ ~. `^` matters most: an
 *    unescaped `^^5c` is a backslash to TeX, so `^` never reaches the source raw.
 *  - `[` and `]` are wrapped in a group (`{[}`) so text that starts with one is never read as an
 *    optional argument (`\item [x]`, `\\[2pt]`).
 *  - The font loads with Ligatures=TeX (and no common ligatures), so "--" and "---" print as en
 *    and em dashes and ``/'' as curly quotes. That is typography, not markup, and is kept.
 *  - Whitespace collapses to single spaces (no blank line can become \par); ASCII and C1 control
 *    characters, U+2028/2029, noncharacters and lone surrogates are dropped.
 *  - Emoji and decorative symbols (pictographs, dingbats, box drawing, arrows, geometric shapes,
 *    variation selectors and joiners) are dropped too (toreview §130): they trip ATS parsers and
 *    read as unprofessional. `decorativeSymbolsIn` counts them so the run can say so. All other
 *    Unicode is kept (XeTeX reads UTF-8).
 */

const SPECIAL: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  $: '\\$',
  '&': '\\&',
  '#': '\\#',
  '%': '\\%',
  _: '\\_',
  '^': '\\textasciicircum{}',
  '~': '\\textasciitilde{}',
  '[': '{[}',
  ']': '{]}',
};

const SPECIAL_RE = /[\\{}$&#%_^~[\]]/g;
const CONTROL_CLASS = '\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F\\uFFFE\\uFFFF';
const CONTROL_RE = new RegExp(`[${CONTROL_CLASS}]`, 'g');
const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const DECORATIVE_RE = /[\p{Extended_Pictographic}\u2190-\u21FF\u2500-\u25FF\u2700-\u27BF\u2B00-\u2BFF\uFE00-\uFE0F\u200D\u20E3]|\p{Regional_Indicator}|\p{Emoji_Modifier}/gu;

/** How many emoji and decorative symbols a text holds: what the PDF leaves out. */
export const decorativeSymbolsIn = (s: string): number => s.match(DECORATIVE_RE)?.length ?? 0;

/** User text as plain normalised text: no control characters, single spaces, trimmed. */
export function normaliseText(s: string): string {
  return s.replace(LONE_SURROGATE_RE, '').replace(CONTROL_RE, '').replace(DECORATIVE_RE, '').replace(/\s+/g, ' ').trim();
}

/** User text, safe anywhere the template prints text (body, arguments, table cells). */
export function texText(s: string): string {
  return normaliseText(s).replace(SPECIAL_RE, (c) => SPECIAL[c] ?? '');
}

const SCHEMES = new Set(['https:', 'mailto:', 'tel:']);
/** Characters left as they are inside \href's url; everything else is percent-encoded. */
const URL_SAFE = /^[A-Za-z0-9\-.:/?=+,;@!'()*]$/;
const MAX_URL = 2048;
const URL_BAD_CHAR_RE = new RegExp('[\\u0000-\\u001F\\u007F-\\u009F\\u2028\\u2029]');

/**
 * A link target safe as the first argument of \href, or null when refused (the caller prints the
 * text without a link). Only https: (with a host and no credentials), mailto: and tel:; any
 * control character in the raw input refuses it. Everything outside a small safe set is
 * percent-encoded, spaces and `& _ ~ $ # [ ] { } \ ^ "` included (equivalent in profile links, but
 * a query string's `&` separator becomes %26), and `%` is written `\%`, which hyperref's \href
 * reads as a percent sign. The result matches `HREF_URL_RE` in texLint.ts.
 */
export function texUrl(url: string): string | null {
  const raw = url.trim();
  if (!raw || raw.length > MAX_URL || URL_BAD_CHAR_RE.test(raw)) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (!SCHEMES.has(parsed.protocol)) return null;
  if (parsed.protocol === 'https:' && (!parsed.hostname || parsed.username || parsed.password)) return null;
  if (parsed.protocol !== 'https:' && parsed.pathname.replace(/^\/+/, '').length === 0) return null;
  const chars = Array.from(parsed.href);
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i] ?? '';
    const hex = `${chars[i + 1] ?? ''}${chars[i + 2] ?? ''}`;
    if (c === '%' && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      out += `\\%${hex.toUpperCase()}`;
      i += 2;
    } else if (URL_SAFE.test(c)) {
      out += c;
    } else {
      for (const byte of new TextEncoder().encode(c)) out += `\\%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    }
  }
  return out;
}
