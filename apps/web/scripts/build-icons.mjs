/**
 * Turns the raw Figma exports under `assets/figma-icons/<board>/` into React components in
 * `src/ui/icons/`.
 *
 * Figma exports a node together with its frame context, so a file can arrive wrapped in the
 * board it was drawn on — a #1E1E1E backing rect, the panel or page, card borders, a
 * backdrop-blur foreignObject and a filter block. When that happens the artwork is the
 * `<path id="Vector*">` elements before `<defs>`, already positioned inside the export's
 * viewBox. Single-group exports arrive clean instead, but carry `preserveAspectRatio="none"`,
 * `overflow="visible"` and an inline `display: block`; the first of those is not cosmetic, it
 * stretches the glyph to whatever box it is given (the trap `toreview.md` §8 hit on mobile).
 *
 * **These glyphs are not single-colour.** The sidebar board draws each one as navy ink
 * (#0F1B8B / #383C7B / #4A2FFE) plus near-white *knockout* paths (#F2F2F9 … #FCFCFD) that punch
 * the holes making it read as line art — the speech bubble's two rules, the folder's face, the
 * monitor's eyes. Repainting every path `currentColor` (which this script used to do) filled
 * those holes in and turned every icon into a solid blob. So ink and knockout are separated by
 * luminance and emitted as an SVG mask: ink paints white in the mask, knockouts paint black, and
 * one `currentColor` rect is drawn through it. The holes are then genuinely transparent, so an
 * icon reads correctly on a white row, a lavender active pill or a muted hover alike — which a
 * hard-coded knockout colour could not do. Icons with no knockout skip the mask entirely.
 *
 * Each icon also keeps the width/height it was drawn at. The board sizes glyphs on a common
 * ~17px *width* with the height left free (Resumes is 17x20.7, Insights 17x15.6), so forcing
 * them all into one square box rendered them at visibly different scales.
 *
 * A board folder may carry a `SOURCES.json` naming where a file came from, for a glyph no board
 * draws: Settings' Privacy & data needed two that are not in the set, a row's and a card tile's,
 * taken from Material Symbols. The generated component's comment then names that source instead,
 * and a source naming a file that isn't there stops the run.
 *
 * Multi-colour drawings go through `build-illustrations.mjs` instead, which keeps their fills —
 * the rule `toreview.md` §6.8 set.
 *
 *   node scripts/build-icons.mjs
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'assets/figma-icons';
const OUT = 'src/ui/icons';

const pascal = (s) => s.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());

const sanitise = (svg) =>
  svg
    .replace(/\spreserveAspectRatio="none"/g, '')
    .replace(/\soverflow="visible"/g, '')
    .replace(/\sstyle="display:\s*block;?"/g, '');

const NAMED = { white: '#ffffff', black: '#000000' };

/**
 * Relative luminance of a Figma fill. The sidebar board's two families sit far apart — ink lands
 * under 0.2, every knockout over 0.9 — so any threshold in between separates them.
 */
const luminance = (fill) => {
  const hex = NAMED[fill] ?? fill;
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`unsupported fill "${fill}"`);
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

mkdirSync(OUT, { recursive: true });
const made = [];

const boards = readdirSync(SRC).filter((d) => statSync(join(SRC, d)).isDirectory());

for (const board of boards) {
  const sourcesFile = join(SRC, board, 'SOURCES.json');
  const origins = existsSync(sourcesFile) ? JSON.parse(readFileSync(sourcesFile, 'utf8')) : {};
  const svgs = readdirSync(join(SRC, board)).filter((f) => f.endsWith('.svg')).sort();

  // A source named for a file that isn't there is a rename or a typo, and the glyph would then be
  // credited to a board it was never drawn on.
  const orphans = Object.keys(origins).filter((file) => !svgs.includes(file));
  if (orphans.length) throw new Error(`${board}/SOURCES.json names missing files: ${orphans}`);

  for (const file of svgs) {
    const slug = file.replace(/\.svg$/, '');
    const raw = sanitise(readFileSync(join(SRC, board, file), 'utf8'));
    const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1];
    if (!viewBox) throw new Error(`${board}/${file}: no viewBox`);
    const [minX, minY, vbW, vbH] = viewBox.split(/[\s,]+/).map(Number);

    const defsAt = raw.indexOf('<defs');
    const body = defsAt >= 0 ? raw.slice(0, defsAt) : raw;

    // A framed export carries its board; a clean one is all artwork.
    const framed = /<rect width="(1536|266)"/.test(raw) || /id="Section"/.test(raw);
    const paths = [...body.matchAll(/<path\s[^>]*\/>/g)]
      .map((m) => m[0])
      .filter((p) => !framed || /id="Vector/.test(p));
    if (!paths.length) throw new Error(`${board}/${file}: no artwork paths found`);

    // Document order is load-bearing: a later knockout cuts an earlier ink shape, so the mask
    // has to replay the same sequence the export paints in.
    const layers = paths.map((p) => {
      const fill = p.match(/fill="([^"]+)"/)?.[1];
      if (!fill) throw new Error(`${board}/${file}: a path has no solid fill to classify`);
      const d = p.match(/\sd="([^"]*)"/)?.[1];
      if (!d) throw new Error(`${board}/${file}: a path has no geometry`);
      // Figma places a path either by baking coordinates into `d` or by leaving a transform on
      // the element; a composite glyph like `ai-spark` (three separately exported stars) is the
      // second kind, so dropping the attribute would stack all of them on the origin.
      const transform = p.match(/\stransform="([^"]*)"/)?.[1];
      return { d, transform, light: luminance(fill) > 0.7 };
    });

    // A knockout only exists relative to ink. Where every path sits in one luminance family the
    // glyph is genuinely single-colour — the Home board's white `upload` arrow, drawn light
    // because it sits on the indigo button — and all of it is artwork.
    const mixed = layers.some((l) => l.light) && layers.some((l) => !l.light);

    const at = (l) => (l.transform ? ` transform="${l.transform}"` : '');

    const svgOpen =
      `<svg viewBox="${viewBox}" width="${vbW}" height="${vbH}" fill="none"` +
      ` aria-hidden focusable="false" {...props}>`;

    let inner;
    if (mixed) {
      const maskId = `nk-icon-${slug}`;
      const box = `x="${minX}" y="${minY}" width="${vbW}" height="${vbH}"`;
      inner =
        `<mask id="${maskId}" maskUnits="userSpaceOnUse" ${box}>\n        ` +
        layers
          .map((l) => `<path${at(l)} d="${l.d}" fill="${l.light ? '#000' : '#fff'}" />`)
          .join('\n        ') +
        `\n      </mask>\n      <rect ${box} fill="currentColor" mask="url(#${maskId})" />`;
    } else {
      inner = layers.map((l) => `<path${at(l)} d="${l.d}" fill="currentColor" />`).join('\n      ');
    }

    const origin = origins[file] ?? `the Figma ${board} board`;
    const name = `${pascal(slug)}Icon`;
    writeFileSync(
      join(OUT, `${name}.tsx`),
      `import type { SVGProps } from 'react';\n\n` +
        `/** Generated by scripts/build-icons.mjs from ${origin}. Do not edit. */\n` +
        `export function ${name}(props: SVGProps<SVGSVGElement>) {\n` +
        `  return (\n    ${svgOpen}\n      ${inner}\n    </svg>\n  );\n}\n`,
    );
    made.push(name);
  }
}

made.sort();
writeFileSync(join(OUT, 'index.ts'), `${made.map((n) => `export { ${n} } from './${n}';`).join('\n')}\n`);
console.log(`wrote ${made.length} icons from ${boards.length} boards to ${OUT}`);
