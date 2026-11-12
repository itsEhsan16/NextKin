import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * The token rule, enforced (redesign R1, `doc/redesign/02-tokens.md` §5.2, §5.6 item 7): raw
 * values live in `theme.css` and `tokens.ts`, nowhere else. Today's code breaks the rule in known
 * places, so each pattern is a **ratchet**: its count may fall, never rise. When a cleanup lowers
 * a count, lower its ceiling here in the same change, and the gain can't be lost again.
 *
 * Allowlisted (§5.5): generated art (`ui/icons`, `ui/illustrations`, `ui/animated`), the
 * print-scale resume and letter pages, and the admin charts until chart tokens land.
 */
const ROOT = join(__dirname, '../..');
const SCANNED = ['src', 'app'];
const ALLOW = [
  'src/ui/icons/',
  'src/ui/illustrations/',
  'src/ui/animated/',
  'src/features/editor/preview/ResumePage.tsx',
  'src/features/editor/preview/LetterPage.tsx',
  'src/features/admin/charts/',
  'src/theme/',
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Code only: comments name colours and sizes all the time, and that is fine. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const sources = SCANNED.flatMap((dir) => files(join(ROOT, dir)))
  .map((path) => ({ path: relative(ROOT, path).split(sep).join('/'), path_: path }))
  .filter(({ path }) => !ALLOW.some((allowed) => path.startsWith(allowed)))
  .map(({ path, path_ }) => ({ path, code: stripComments(readFileSync(path_, 'utf8')) }));

type Rule = { name: string; pattern: RegExp; ceiling: number; fix: string };

/** Ceilings are the counts on 2026-11-12 (redesign R1). They only ever go down. */
const RULES: Rule[] = [
  {
    name: 'raw colour literals (hex, rgb, hsl)',
    pattern: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])|\brgba?\(|\bhsla?\(/g,
    ceiling: 2,
    fix: 'use a colour token class, or read the value from `@/theme/tokens`',
  },
  {
    name: "Tailwind's default palette (not our tokens)",
    pattern:
      /\b(?:bg|text|border|ring|fill|stroke|outline|accent|divide|from|via|to)-(?:white|black|(?:gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate)-\d{2,3})\b/g,
    ceiling: 4,
    fix: 'use the semantic or ramp token (`text-text-inverse`, `bg-neutral-0`, …)',
  },
  {
    name: 'numeric z-index',
    pattern: /\bz-(?:\d+|\[[^\]]+\])/g,
    ceiling: 13,
    fix: 'use a z-layer token once R2 adds them (`02-tokens.md` §2.14)',
  },
  {
    name: 'arbitrary radius',
    pattern: /\brounded(?:-[a-z]{1,2})?-\[[^\]]+\]/g,
    ceiling: 39,
    fix: 'use `rounded-sm|md|lg|xl|2xl|full`, or add a radius token',
  },
  {
    name: 'arbitrary font size',
    pattern: /\btext-\[\d[^\]]*\]/g,
    ceiling: 7,
    fix: 'use a type role (`text-body-m`, `text-caption-m`, …)',
  },
  {
    name: 'raw duration or easing',
    pattern: /\bduration-\d+\b|\bduration-\[[^\]]+\]|\bease-\[[^\]]+\]/g,
    ceiling: 0,
    fix: 'use `duration-press|fast|base|…` and `ease-standard|decelerate|spring`',
  },
  {
    name: 'arbitrary shadow',
    pattern: /\bshadow-\[[^\]]+\]/g,
    ceiling: 2,
    fix: 'use a shadow token (`shadow-card`, `shadow-popover`, …)',
  },
  {
    // Every other `-[…]` value: mostly one-off sizes (`w-[146px]`). Grid tracks (`grid-cols-[…]`)
    // and `var(--…)` reads are layout techniques on tokens, and `data-[…]`/`aria-[…]` are state
    // selectors rather than values, so none of them count. Overlaps the narrower rules above on
    // purpose: this is the total to drive down.
    name: 'other arbitrary values',
    pattern:
      /\b(?!grid-(?:cols|rows)-|(?:group-|peer-)?(?:data|aria)-)[a-z][a-z0-9-]*-\[(?!var\()[^\]]+\]/g,
    ceiling: 737,
    fix: 'use a spacing, size or container token; add one if the value repeats',
  },
];

const count = (pattern: RegExp) =>
  sources
    .map(({ path, code }) => ({ path, hits: code.match(pattern)?.length ?? 0 }))
    .filter(({ hits }) => hits > 0);

describe('raw values stay inside the token files (ratchet)', () => {
  it.each(RULES)('$name: at most $ceiling', ({ pattern, ceiling, fix }) => {
    const found = count(pattern);
    const total = found.reduce((sum, { hits }) => sum + hits, 0);
    const where = found
      .sort((a, b) => b.hits - a.hits)
      .map(({ path, hits }) => `  ${hits}× ${path}`)
      .join('\n');
    if (total > ceiling) {
      throw new Error(`${total} found, ceiling ${ceiling}. Fix: ${fix}.\n${where}`);
    }
    if (total < ceiling) {
      throw new Error(
        `Down to ${total} from ${ceiling}: lower this rule's ceiling to ${total} so it can't creep back.`,
      );
    }
  });
});
