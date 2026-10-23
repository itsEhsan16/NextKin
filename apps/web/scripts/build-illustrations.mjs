/**
 * Turns the board illustrations under `assets/figma-illustrations/<board>/` into React
 * components in `src/ui/illustrations/`.
 *
 * Two shapes come out of Figma and this handles both:
 *  - A node exported whole arrives wrapped in its frame — a #1E1E1E backing rect, the 1536x1024
 *    page, card borders — with the artwork as `<path id="Vector*">` before `<defs>`.
 *  - A single-group vector arrives clean, but carrying `preserveAspectRatio="none"`,
 *    `overflow="visible"` and an inline `display: block`. The first of those is not cosmetic:
 *    it stretches the artwork to whatever box it is given instead of keeping its proportions
 *    (the same trap `toreview.md` §8 hit on the mobile side).
 *
 * Unlike the nav glyphs these keep their fills — they are 5-13 path multi-colour drawings and
 * there is nothing a single `color` could drive (the rule mobile set in `toreview.md` §6.8).
 *
 * A drawing whose artwork paints from a gradient keeps the `<defs>` that gradient lives in.
 * Dropping them (which this script used to do) left a `fill="url(#paint0_linear_0_4)"` pointing
 * at nothing, which is how the NextKin logo mark lost its swoosh. Gradient ids are rewritten
 * with the file's slug first, because SVG ids resolve document-wide and Figma numbers them per
 * export — two drawings on one page would otherwise both answer to `#paint0_linear_0_4`.
 *
 * A board folder may carry a `SOURCES.json` naming where a file came from, for art that is not a
 * Figma export: the Upload a JD page's source logos, which its board no longer draws, come from
 * Iconify's CC0 logo sets. The generated component's comment then names that source instead.
 *
 *   node scripts/build-illustrations.mjs
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'assets/figma-illustrations';
const OUT = 'src/ui/illustrations';

const pascal = (s) => s.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());

/** Strip the three attributes Figma now emits that no other asset in this repo carries. */
const sanitise = (svg) =>
  svg
    .replace(/\spreserveAspectRatio="none"/g, '')
    .replace(/\soverflow="visible"/g, '')
    .replace(/\sstyle="display:\s*block;?"/g, '');

/** `stop-color` → `stopColor`, `gradientUnits` untouched — JSX wants camelCase attributes. */
const toJsxAttrs = (s) => s.replace(/\s([a-z]+)-([a-z])/g, (_, a, b) => ` ${a}${b.toUpperCase()}`);

mkdirSync(OUT, { recursive: true });
const made = [];

const boards = readdirSync(SRC).filter((d) => statSync(join(SRC, d)).isDirectory());

for (const board of boards) {
  const sourcesFile = join(SRC, board, 'SOURCES.json');
  const origins = existsSync(sourcesFile) ? JSON.parse(readFileSync(sourcesFile, 'utf8')) : {};

  for (const file of readdirSync(join(SRC, board)).filter((f) => f.endsWith('.svg')).sort()) {
    const slug = file.replace(/\.svg$/, '');
    const raw = sanitise(readFileSync(join(SRC, board, file), 'utf8'));
    const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1];
    if (!viewBox) throw new Error(`${board}/${file}: no viewBox`);

    const defsAt = raw.indexOf('<defs');
    const body = defsAt >= 0 ? raw.slice(0, defsAt) : raw;

    // Frame-wrapped exports name their artwork; clean single-group files are all artwork.
    const framed = /<rect width="(1536|266)"/.test(raw) || /id="Section"/.test(raw);
    const paths = [...body.matchAll(/<path\s[^>]*\/>/g)]
      .map((m) => m[0])
      .filter((p) => !framed || /id="Vector/.test(p));
    if (!paths.length) throw new Error(`${board}/${file}: no artwork paths found`);

    let cleaned = paths.map((p) =>
      p.replace(/\sid="[^"]*"/g, '').replace(/([a-z])-([a-z])/g, (_, a, b) => a + b.toUpperCase()),
    );

    // Keep only the gradients the surviving artwork actually paints from — a framed export also
    // carries the panel gradient and blur filter behind it, which are not part of the drawing.
    const used = [...new Set([...cleaned.join('').matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]))];
    let defs = '';
    if (used.length) {
      const raws = raw.slice(defsAt);
      const kept = used
        .map((id) => {
          const at = raws.indexOf(`id="${id}"`);
          if (at < 0) throw new Error(`${board}/${file}: artwork references #${id}, absent from <defs>`);
          const open = raws.lastIndexOf('<', at);
          const tag = raws.slice(open + 1).match(/^[\w]+/)?.[0];
          const end = raws.indexOf(`</${tag}>`, at);
          if (!tag || end < 0) throw new Error(`${board}/${file}: could not bound <${tag}> #${id}`);
          return toJsxAttrs(raws.slice(open, end + tag.length + 3));
        })
        .join('\n        ');
      // Namespace after extraction so the lookup above still matches Figma's original ids.
      const ns = (s) => used.reduce((acc, id) => acc.split(id).join(`nk-${slug}-${id}`), s);
      cleaned = cleaned.map(ns);
      defs = `\n      <defs>\n        ${ns(kept)}\n      </defs>`;
    }

    const origin = origins[file] ?? `the Figma ${board} board`;
    const name = `${pascal(slug)}Illustration`;
    writeFileSync(
      join(OUT, `${name}.tsx`),
      `import type { SVGProps } from 'react';\n\n` +
        `/** Generated by scripts/build-illustrations.mjs from ${origin}. Do not edit. */\n` +
        `export function ${name}(props: SVGProps<SVGSVGElement>) {\n` +
        `  return (\n    <svg viewBox="${viewBox}" fill="none" aria-hidden focusable="false" {...props}>\n      ` +
        `${cleaned.join('\n      ')}${defs}\n    </svg>\n  );\n}\n`,
    );
    made.push(name);
  }
}

made.sort();
writeFileSync(join(OUT, 'index.ts'), `${made.map((n) => `export { ${n} } from './${n}';`).join('\n')}\n`);
console.log(`wrote ${made.length} illustrations from ${boards.length} boards to ${OUT}`);
