/**
 * Regenerates src/dev/figmaRefs.generated.ts from the PNGs in assets/figma/.
 *
 * The renders come from the Figma MCP `get_screenshot` tool, saved as `<node-id>.png` with the
 * colon replaced by a dash (1:2189 → 1-2189.png). A node with an outer effect renders larger
 * than its frame — Home's drop shadow makes it 640×1478 for a 520×1358 frame — so the overlay
 * needs both boxes to line the frame up with the screen.
 *
 * The file draws every screen twice: the "Mobile App" page at 520 and the "Mobile 2" page at
 * 390. Geometry is identical between them (Mobile 2 is Mobile App × 0.75, node for node); only
 * the type differs. Both are listed so either can be laid over the app — and on a 390dp phone
 * the 390 render is 1:1, which is the closest reading available.
 *
 *   node scripts/figma-refs.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets', 'figma');
const OUT = path.join(ROOT, 'src', 'dev', 'figmaRefs.generated.ts');

/**
 * Frame boxes from get_metadata, and each node's render box from get_screenshot's
 * `original_width`/`original_height`. They differ only when the node has an outer effect:
 * Home's drop shadow renders 640×1478 around its 520×1358 frame, and 480×1128 around its
 * 390×1038.434 one. Both are in artboard units; the PNG on disk is the same box scaled down,
 * and is only checked for aspect here.
 */
const FRAMES = {
  // ── "Mobile App" (520) ────────────────────────────────────────────────────────────────
  '1:2': { name: 'DESIGN 2 — Home', width: 520, height: 1358, render: [640, 1478] },
  '1:263': { name: 'JOBS 01 — Discover', width: 520, height: 1440, render: [520, 1440] },
  '1:397': { name: 'JOBS 02 — Saved', width: 520, height: 1440, render: [520, 1440] },
  '1:512': { name: 'JOBS 03 — Applied', width: 520, height: 1440, render: [520, 1440] },
  '1:626': { name: 'JOBS 04 — Filters', width: 520, height: 1440, render: [520, 1440] },
  '1:830': { name: 'JOBS 05 — Job Detail', width: 520, height: 1720, render: [520, 1720] },
  '1:932': { name: 'JOBS 06 — Discover empty', width: 520, height: 1440, render: [520, 1440] },
  '1:977': { name: 'JOBS 07 — Saved empty', width: 520, height: 1440, render: [520, 1440] },
  '1:1010': { name: 'JOBS 08 — Applied empty', width: 520, height: 1440, render: [520, 1440] },
  '1:1044': { name: 'CREATE 01 — + sheet', width: 520, height: 1440, render: [520, 1440] },
  '1:1208': { name: 'CREATE 02 — New Resume', width: 520, height: 1440, render: [520, 1440] },
  '1:1366': { name: 'RESUMES 01 — Grid', width: 520, height: 1440, render: [520, 1440] },
  '1:1588': { name: 'RESUMES 02 — List', width: 520, height: 1440, render: [520, 1440] },
  '1:1798': { name: 'RESUMES 03 — Card menu', width: 520, height: 1440, render: [520, 1440] },
  '1:2061': { name: 'RESUMES 05 — First run', width: 520, height: 1440, render: [520, 1440] },
  '1:2109': { name: 'RESUMES 04 — Score panel', width: 520, height: 1520, render: [520, 1520] },
  '1:2189': { name: 'PROFILE 01 — Overview', width: 520, height: 1440, render: [520, 1440] },
  '1:2313': { name: 'PROFILE 02 — Settings', width: 520, height: 1440, render: [520, 1440] },
  '1:2402': { name: 'NOTIF 01 — Feed', width: 520, height: 1440, render: [520, 1440] },
  '1:2498': { name: 'NOTIF 02 — Swipe actions', width: 520, height: 1440, render: [520, 1440] },
  '1:2601': { name: 'NOTIF 03 — Row menu', width: 520, height: 1440, render: [520, 1440] },
  '1:2711': { name: 'NOTIF 04 — Preferences', width: 520, height: 1440, render: [520, 1440] },
  '1:2766': { name: 'NOTIF 05 — All caught up', width: 520, height: 1440, render: [520, 1440] },
  '1:2788': { name: 'NOTIF 06 — First use', width: 520, height: 1440, render: [520, 1440] },
  '1:2822': { name: 'NOTIF 07 — Push primer', width: 520, height: 1720, render: [520, 1720] },

  // ── "Mobile 2" (390) ──────────────────────────────────────────────────────────────────
  // Home is the one auto-height frame, so it is the one whose height is not a flat 0.75 of its
  // twin: 1038.434 against 1018.5. Its type grew and the frame grew with it, which is the whole
  // change in a single number.
  '115:2': { name: 'DESIGN 2 — Home', width: 390, height: 1038.434, render: [480, 1128] },
  '118:2': { name: 'JOBS 01 — Discover', width: 390, height: 1080, render: [390, 1080] },
  '118:155': { name: 'JOBS 02 — Saved', width: 390, height: 1080, render: [390, 1080] },
  '95:553': { name: 'JOBS 03 — Applied', width: 390, height: 1080, render: [390, 1080] },
  '95:687': { name: 'JOBS 04 — Filters', width: 390, height: 1080, render: [390, 1080] },
  '95:891': { name: 'JOBS 05 — Job Detail', width: 390, height: 1290, render: [390, 1290] },
  '95:993': { name: 'JOBS 06 — Discover empty', width: 390, height: 1080, render: [390, 1080] },
  '95:1058': { name: 'JOBS 07 — Saved empty', width: 390, height: 1080, render: [390, 1080] },
  '95:1111': { name: 'JOBS 08 — Applied empty', width: 390, height: 1080, render: [390, 1080] },
  '95:1165': { name: 'CREATE 01 — + sheet', width: 390, height: 1080, render: [390, 1080] },
  '95:1349': { name: 'CREATE 02 — New Resume', width: 390, height: 1080, render: [390, 1080] },
  '95:1527': { name: 'RESUMES 01 — Grid', width: 390, height: 1080, render: [390, 1080] },
  '95:1769': { name: 'RESUMES 02 — List', width: 390, height: 1080, render: [390, 1080] },
  // Only on this page: 02 with every subtitle clamped to one line, which puts the rows back on
  // a uniform 126. That frame is what ResumeListRow builds.
  '151:2': { name: 'RESUMES 02b — List 1-line', width: 390, height: 1080, render: [390, 1080] },
  '95:1999': { name: 'RESUMES 03 — Card menu', width: 390, height: 1080, render: [390, 1080] },
  '95:2262': { name: 'RESUMES 05 — First run', width: 390, height: 1080, render: [390, 1080] },
  '95:2310': { name: 'RESUMES 04 — Score panel', width: 390, height: 1140, render: [390, 1140] },
  '95:2390': { name: 'PROFILE 01 — Overview', width: 390, height: 1080, render: [390, 1080] },
  '95:2514': { name: 'PROFILE 02 — Settings', width: 390, height: 1080, render: [390, 1080] },
  '95:2603': { name: 'NOTIF 01 — Feed', width: 390, height: 1080, render: [390, 1080] },
  '95:2699': { name: 'NOTIF 02 — Swipe actions', width: 390, height: 1080, render: [390, 1080] },
  '95:2802': { name: 'NOTIF 03 — Row menu', width: 390, height: 1080, render: [390, 1080] },
  '95:2912': { name: 'NOTIF 04 — Preferences', width: 390, height: 1080, render: [390, 1080] },
  '95:2967': { name: 'NOTIF 05 — All caught up', width: 390, height: 1080, render: [390, 1080] },
  '95:2989': { name: 'NOTIF 06 — First use', width: 390, height: 1080, render: [390, 1080] },
  '95:3023': { name: 'NOTIF 07 — Push primer', width: 390, height: 1290, render: [390, 1290] },
};

/** PNG stores width/height as big-endian uint32 at bytes 16 and 20 of the IHDR chunk. */
function pngSize(file) {
  const head = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, head, 0, 24, 0);
  fs.closeSync(fd);
  if (head.toString('ascii', 1, 4) !== 'PNG') throw new Error(`not a PNG: ${file}`);
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

const entries = Object.entries(FRAMES).map(([id, frame]) => {
  const file = path.join(ASSETS, `${id.replace(':', '-')}.png`);
  if (!fs.existsSync(file)) throw new Error(`missing render for ${id} (${file})`);

  // The PNG is the render box scaled down, so its aspect must still match. A mismatch means the
  // file was re-exported at different bounds and the overlay would sit off by that much.
  const png = pngSize(file);
  const [renderWidth, renderHeight] = frame.render;
  const drift = Math.abs(png.width / png.height - renderWidth / renderHeight);
  if (drift > 0.005) {
    throw new Error(
      `${id}: PNG is ${png.width}x${png.height} but the render box is ${renderWidth}x${renderHeight}`,
    );
  }

  return {
    id,
    name: frame.name,
    width: frame.width,
    height: frame.height,
    render: { width: renderWidth, height: renderHeight },
  };
});

const lines = [
  '// Generated by scripts/figma-refs.cjs — do not edit by hand.',
  "import type { FigmaRef } from './figmaRefs';",
  '',
  'export const FIGMA_REFS: readonly FigmaRef[] = [',
  ...entries.map(
    (e) =>
      `  {\n` +
      `    id: '${e.id}',\n` +
      `    name: '${e.name.replace(/'/g, "\\'")}',\n` +
      `    frameWidth: ${e.width},\n` +
      `    frameHeight: ${e.height},\n` +
      `    renderWidth: ${e.render.width},\n` +
      `    renderHeight: ${e.render.height},\n` +
      `    source: require('../../assets/figma/${e.id.replace(':', '-')}.png'),\n` +
      `  },`,
  ),
  '];',
  '',
];

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`wrote ${entries.length} refs to ${path.relative(ROOT, OUT)}`);
