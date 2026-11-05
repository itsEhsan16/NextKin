/**
 * Copies the lucide-animated icons the admin portal uses into `src/ui/animated/lucide/`.
 *
 * lucide-animated (https://lucide-animated.com, MIT) ships each icon as a shadcn registry item:
 * one React file built on `motion`. The shadcn CLI would also try to write its own
 * `components.json`, `cn` helper and Tailwind setup, none of which this app uses. So this script
 * fetches each item's JSON and writes the file itself, with one change: the `cn` import points at
 * `@/lib/cn`.
 *
 * The files are vendored, not edited by hand. To add an icon, add its kebab-case name to `ICONS`
 * and run `node scripts/vendor-animated-icons.mjs` from `apps/web`, then map it in
 * `src/ui/animated/iconMap.ts`. Icons lucide-animated does not have come from react-useanimations
 * instead (see that map), which needs no copying.
 */
import { execSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICONS = [
  'activity',
  'archive',
  'arrow-down',
  'arrow-right',
  'arrow-up',
  'arrow-up-right',
  'badge-percent',
  'bell',
  'book-text',
  'bookmark',
  'calendar-days',
  'chart-column-increasing',
  'chart-pie',
  'check',
  'chevron-down',
  'chevron-right',
  'chevrons-up-down',
  'circle-check',
  'circle-help',
  'clipboard-check',
  'clock',
  'cloud-upload',
  'copy',
  'credit-card',
  'delete',
  'dollar-sign',
  'download',
  'earth',
  'eye',
  'file-check',
  'file-text',
  'gauge',
  'git-branch',
  'git-compare-arrows',
  'hand-coins',
  'home',
  'hourglass',
  'key',
  'layout-grid',
  'layout-panel-top',
  'link',
  'lock',
  'logout',
  'mail-check',
  'menu',
  'mic',
  'monitor-check',
  'play',
  'plus',
  'refresh-cw',
  'search',
  'send',
  'server',
  'settings',
  'shield-check',
  'sparkles',
  'square-pen',
  'terminal',
  'trending-up',
  'undo',
  'user-plus',
  'users',
  'users-round',
  'x',
  'zap',
];

/**
 * Corrections to an icon as the registry ships it. clipboard-check hides its tick until it
 * animates, so at rest it drew an empty clipboard where the boards draw the tick (toreview §171.10).
 */
const PATCHES = {
  'clipboard-check': [[/(normal:\s*\{\s*pathLength:\s*1,\s*opacity:\s*)0/, '$11']],
};

const REGISTRY = 'https://lucide-animated.com/r';
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'src', 'ui', 'animated', 'lucide');

const HEADER = `// Vendored from lucide-animated (https://lucide-animated.com, MIT) by
// scripts/vendor-animated-icons.mjs. Do not edit; re-run the script instead.
`;

await mkdir(outDir, { recursive: true });

const written = [];
for (const name of ICONS) {
  const response = await fetch(`${REGISTRY}/${name}.json`);
  if (!response.ok) throw new Error(`${name}: ${response.status} from the registry`);
  const item = await response.json();
  const file = item.files?.[0];
  if (!file?.content) throw new Error(`${name}: the registry item has no file`);
  let source = file.content
    .replace(/from ["']@\/lib\/utils["']/, "from '@/lib/cn'")
    // Each icon wraps its <svg> in a <div>, which is invalid inside a badge, a label or a
    // paragraph; an inline-flex <span> (AdminIcon's class) lays out the same.
    .replace(/<div\b/g, '<span')
    .replace(/<\/div>/g, '</span>')
    .replace(/HTMLDivElement/g, 'HTMLSpanElement');
  for (const [pattern, replacement] of PATCHES[name] ?? []) {
    if (!pattern.test(source)) throw new Error(`${name}: a patch no longer applies`);
    source = source.replace(pattern, replacement);
  }
  const target = join(outDir, `${name}.tsx`);
  // "use client" has to stay the first statement, so the header goes after it.
  const body = source.startsWith('"use client"')
    ? source.replace(/^"use client";?\n/, `'use client';\n\n${HEADER}`)
    : `${HEADER}${source}`;
  await writeFile(target, body);
  written.push(target);
}

// The checkout path has spaces in it, and `npx` on Windows needs a shell: quote the folder.
execSync(`npx prettier --write "${outDir}"`, { stdio: 'inherit' });
console.log(`Wrote ${written.length} icons to ${outDir}`);
