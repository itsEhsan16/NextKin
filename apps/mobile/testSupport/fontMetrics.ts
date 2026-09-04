import { fontFamily, type FontWeightKey } from '@/theme/typography';

/**
 * The two Node modules this file needs, declared structurally rather than installed.
 *
 * `tsconfig.json` pins `types: ["jest"]` on purpose — app code has no business seeing `fs` or
 * `process`. Adding `@types/node` to satisfy one test-support module would hand every source
 * file those globals, so this makes the same call `testSupport/scroller.ts` made for
 * `react-test-renderer`: describe the shape, skip the dependency.
 */
type Bytes = {
  readonly length: number;
  readInt16BE(offset: number): number;
  readUInt16BE(offset: number): number;
  readUInt32BE(offset: number): number;
  toString(encoding: string, start: number, end: number): string;
};

type NodeModules = {
  'node:fs': { readFileSync(path: string): Bytes };
  'node:path': { dirname(path: string): string; join(...parts: string[]): string };
};

const load = require as unknown as (<K extends keyof NodeModules>(id: K) => NodeModules[K]) & {
  resolve(id: string): string;
};

const { readFileSync } = load('node:fs');
const { dirname, join } = load('node:path');

/**
 * Exact glyph advances, read out of the TTFs the app actually ships.
 *
 * `__tests__/theme/typeRamp.test.ts` can already prove a line box fits the height drawn around
 * it, because a line height is a number in the ramp. Width had no such number: whether "100%"
 * fits a 44-unit badge depends on Plus Jakarta Sans, and nothing in the repo knew how wide its
 * digits are. So that half went unchecked, and the profile completeness badge shipped sized for
 * the "72%" on the artboard while `profileRepo` can walk it up to a four-character "100%".
 *
 * This parses just enough TrueType to close that gap — head, hhea, hmtx and cmap — so a test can
 * ask for a string's advance in dp and compare it against the box. No new dependency: the fonts
 * are already `@expo-google-fonts` deps, resolved by name so a version bump cannot stale the path.
 */

const PACKAGE_OF: Record<string, string> = {
  PlusJakartaSans: '@expo-google-fonts/plus-jakarta-sans',
  Inter: '@expo-google-fonts/inter',
};

/** `PlusJakartaSans_700Bold` → `<pkg>/700Bold/PlusJakartaSans_700Bold.ttf`. */
function fontFile(postScriptName: string): string {
  const [family, style] = postScriptName.split('_');
  const pkg = PACKAGE_OF[family ?? ''];
  if (!pkg || !style) throw new Error(`fontMetrics: cannot place "${postScriptName}"`);
  const root = dirname(load.resolve(`${pkg}/package.json`));
  return join(root, style, `${postScriptName}.ttf`);
}

type Font = {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  lineGap: number;
  advances: readonly number[];
  cmap: ReadonlyMap<number, number>;
};

const loaded = new Map<string, Font>();

function parse(postScriptName: string): Font {
  const b = readFileSync(fontFile(postScriptName));

  const tables = new Map<string, number>();
  const numTables = b.readUInt16BE(4);
  for (let i = 0; i < numTables; i++) {
    const record = 12 + i * 16;
    tables.set(b.toString('ascii', record, record + 4), b.readUInt32BE(record + 8));
  }
  const at = (tag: string): number => {
    const off = tables.get(tag);
    if (off === undefined) throw new Error(`fontMetrics: ${postScriptName} has no ${tag} table`);
    return off;
  };

  const head = at('head');
  const hhea = at('hhea');
  const numberOfHMetrics = b.readUInt16BE(hhea + 34);
  const hmtx = at('hmtx');
  const advances: number[] = [];
  for (let i = 0; i < numberOfHMetrics; i++) advances.push(b.readUInt16BE(hmtx + i * 4));

  return {
    unitsPerEm: b.readUInt16BE(head + 18),
    ascender: b.readInt16BE(hhea + 4),
    descender: b.readInt16BE(hhea + 6),
    lineGap: b.readInt16BE(hhea + 8),
    advances,
    cmap: readCmap(b, at('cmap'), postScriptName),
  };
}

/** Codepoint → glyph id. Format 12 when present (full Unicode), else the format 4 BMP table. */
function readCmap(b: Bytes, cmap: number, name: string): Map<number, number> {
  let chosen: { sub: number; format: number; rank: number } | null = null;
  const subtables = b.readUInt16BE(cmap + 2);
  for (let i = 0; i < subtables; i++) {
    const record = cmap + 4 + i * 8;
    const platform = b.readUInt16BE(record);
    const encoding = b.readUInt16BE(record + 2);
    const sub = cmap + b.readUInt32BE(record + 4);
    const format = b.readUInt16BE(sub);
    const rank = format === 12 ? 3 : format === 4 && platform === 3 && encoding === 1 ? 2 : format === 4 ? 1 : 0;
    if (rank > 0 && (chosen === null || rank > chosen.rank)) chosen = { sub, format, rank };
  }
  if (chosen === null) throw new Error(`fontMetrics: ${name} has no format 4 or 12 cmap`);

  const map = new Map<number, number>();
  if (chosen.format === 12) {
    const groups = b.readUInt32BE(chosen.sub + 12);
    for (let g = 0; g < groups; g++) {
      const record = chosen.sub + 16 + g * 12;
      const start = b.readUInt32BE(record);
      const end = b.readUInt32BE(record + 4);
      const glyph = b.readUInt32BE(record + 8);
      for (let cp = start; cp <= end; cp++) map.set(cp, glyph + (cp - start));
    }
    return map;
  }

  const segX2 = b.readUInt16BE(chosen.sub + 6);
  const endCodes = chosen.sub + 14;
  const startCodes = endCodes + segX2 + 2;
  const idDeltas = startCodes + segX2;
  const idRangeOffsets = idDeltas + segX2;
  for (let seg = 0; seg < segX2 / 2; seg++) {
    const start = b.readUInt16BE(startCodes + seg * 2);
    const end = b.readUInt16BE(endCodes + seg * 2);
    if (start === 0xffff) continue;
    const delta = b.readInt16BE(idDeltas + seg * 2);
    const rangeOffset = b.readUInt16BE(idRangeOffsets + seg * 2);
    for (let cp = start; cp <= end; cp++) {
      let glyph: number;
      if (rangeOffset === 0) glyph = (cp + delta) & 0xffff;
      else {
        const index = idRangeOffsets + seg * 2 + rangeOffset + (cp - start) * 2;
        if (index + 1 >= b.length) continue;
        glyph = b.readUInt16BE(index);
        if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph !== 0) map.set(cp, glyph);
    }
  }
  return map;
}

function font(family: FontWeightKey): Font {
  const postScriptName = fontFamily[family];
  const cached = loaded.get(postScriptName);
  if (cached) return cached;
  const parsed = parse(postScriptName);
  loaded.set(postScriptName, parsed);
  return parsed;
}

/** The `fontFamily` a `typography` role resolves to, back to its `fontFamily` key. */
export function weightOf(resolvedFamily: string | undefined): FontWeightKey {
  const hit = (Object.keys(fontFamily) as FontWeightKey[]).find(
    (key) => fontFamily[key] === resolvedFamily,
  );
  if (!hit) throw new Error(`fontMetrics: unknown fontFamily "${resolvedFamily}"`);
  return hit;
}

/**
 * Advance width of `text` in dp — what the text lays out to, before any box is drawn around it.
 *
 * Kerning is ignored: `kern`/GPOS shift glyphs relative to each other but the pairs in UI strings
 * ("100%", "Save", a count) move by a fraction of a unit, and ignoring them errs *wide*, which is
 * the safe direction for a fit assertion.
 */
export function textWidth(
  role: { fontFamily?: string; fontSize?: number; letterSpacing?: number },
  text: string,
): number {
  const f = font(weightOf(role.fontFamily));
  const size = role.fontSize ?? 0;
  let units = 0;
  for (const character of text) {
    const glyph = f.cmap.get(character.codePointAt(0) ?? 0) ?? 0;
    units += f.advances[Math.min(glyph, f.advances.length - 1)] ?? 0;
  }
  return (units / f.unitsPerEm) * size + (role.letterSpacing ?? 0) * [...text].length;
}

/**
 * The line height the font asks for, in dp.
 *
 * A `lineHeight` below this is not a fit — Android compresses the line and shaves the ascenders.
 */
export function naturalLineHeight(role: { fontFamily?: string; fontSize?: number }): number {
  const f = font(weightOf(role.fontFamily));
  return ((f.ascender - f.descender + f.lineGap) / f.unitsPerEm) * (role.fontSize ?? 0);
}
