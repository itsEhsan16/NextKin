/**
 * Regenerates every launcher/splash icon in `assets/` from the brand mark.
 *
 * The mark is three overlapping vector layers (`assets/brand/mark-{1,2,3}.svg`) composed at
 * 51x53 — the same lock-up `src/ui/BrandMark` draws on screen. This script composes them into
 * one SVG, rasterises that once, then pads and resizes the result into the six PNGs
 * `app.config.ts` points at.
 *
 * Rasterising SVG needs a vector renderer, which the app deliberately does not depend on:
 * hard rule 1 keeps `package.json` to things that run inside Expo Go. So the renderer is
 * invoked as a one-off through `npx sharp-cli` and its output is committed as
 * `assets/brand/mark-1024.png`. When npx is unavailable (offline, CI without a registry) the
 * committed PNG is reused and only the compositing re-runs — so this script always works, and
 * only a change to the mark itself needs the network.
 *
 * Usage:  node scripts/generate-icons.cjs  [--no-raster]
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const Jimp = require('jimp-compact');

const ASSETS = path.join(__dirname, '..', 'assets');
const BRAND = path.join(ASSETS, 'brand');
const COMPOSED_SVG = path.join(BRAND, 'mark-composed.svg');
const MARK_PNG = path.join(BRAND, 'mark-1024.png');

/** The composite box and each layer's offset, mirroring `src/ui/BrandMark`. */
const BOX = { width: 51, height: 53 };
const LAYERS = [
  { file: 'mark-1.svg', x: 0, y: 0 },
  { file: 'mark-2.svg', x: 22, y: 21 },
  { file: 'mark-3.svg', x: 23, y: 21 },
];

/** Rasterised mark: tight to the artwork, tall enough for every target below. */
const MARK_PX = { height: 1024, width: Math.round((1024 * BOX.width) / BOX.height) }; // 985x1024

const WHITE = 0xffffffff;
const TRANSPARENT = 0x00000000;

/**
 * Each icon is the mark centred on a square canvas. `markRatio` is the mark's height as a
 * fraction of the canvas — Android's adaptive layers must stay inside the inner 66% safe
 * circle, so their mark is smaller than the iOS one.
 */
const TARGETS = [
  { file: 'icon.png', size: 1024, markRatio: 0.62, background: WHITE, opaque: true },
  { file: 'android-icon-foreground.png', size: 1024, markRatio: 0.55, background: TRANSPARENT },
  { file: 'android-icon-background.png', size: 1024, markRatio: 0, background: WHITE, opaque: true },
  { file: 'android-icon-monochrome.png', size: 1024, markRatio: 0.55, background: TRANSPARENT, silhouette: 0x000000 },
  { file: 'splash-icon.png', size: 1024, markRatio: 0.62, background: TRANSPARENT },
  { file: 'favicon.png', size: 48, markRatio: 0.85, background: TRANSPARENT },
];

/** Strips the `<svg>` wrapper off a layer and namespaces its ids, so gradients cannot collide. */
function innerSvg(file, index) {
  const raw = fs.readFileSync(path.join(BRAND, file), 'utf8');
  const body = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return body.replace(/id="([^"]+)"/g, `id="l${index}_$1"`).replace(/url\(#([^)]+)\)/g, `url(#l${index}_$1)`);
}

function composeSvg() {
  const layers = LAYERS.map(({ file, x, y }, i) => `  <g transform="translate(${x} ${y})">${innerSvg(file, i)}  </g>`);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${MARK_PX.width}" height="${MARK_PX.height}" viewBox="0 0 ${BOX.width} ${BOX.height}" fill="none">`,
    ...layers,
    '</svg>',
    '',
  ].join('\n');
}

function rasterise() {
  // `shell: true` because npx is a .cmd shim on Windows, which spawn cannot exec directly.
  execFileSync(
    'npx',
    ['--yes', 'sharp-cli', '--input', JSON.stringify(COMPOSED_SVG), '--output', JSON.stringify(BRAND),
     '--format', 'png', 'resize', String(MARK_PX.width), String(MARK_PX.height)],
    { stdio: 'inherit', cwd: path.join(__dirname, '..'), shell: true },
  );
  // sharp-cli writes <output-dir>/<input-basename>.png; rename it to the committed source name.
  const emitted = path.join(BRAND, 'mark-composed.png');
  if (fs.existsSync(emitted)) fs.renameSync(emitted, MARK_PNG);
}

/** Repaints every visible pixel one colour, keeping the alpha — Android tints this layer itself. */
function flatten(image, rgb) {
  const [r, g, b] = [(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff];
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, (_x, _y, idx) => {
    image.bitmap.data[idx] = r;
    image.bitmap.data[idx + 1] = g;
    image.bitmap.data[idx + 2] = b;
  });
  return image;
}

async function main() {
  fs.writeFileSync(COMPOSED_SVG, composeSvg());
  console.log(`composed  ${path.relative(process.cwd(), COMPOSED_SVG)}`);

  if (!process.argv.includes('--no-raster')) {
    try {
      rasterise();
    } catch (error) {
      if (!fs.existsSync(MARK_PNG)) throw error;
      console.warn(`! sharp-cli unavailable (${error.message.split('\n')[0]}) — reusing the committed mark-1024.png`);
    }
  }

  const mark = await Jimp.read(MARK_PNG);
  if (!mark.hasAlpha()) {
    throw new Error(`${MARK_PNG} has no alpha channel; the mark must be transparent outside the artwork.`);
  }

  for (const { file, size, markRatio, background, opaque, silhouette } of TARGETS) {
    const canvas = new Jimp(size, size, background);
    if (markRatio > 0) {
      const height = Math.round(size * markRatio);
      const width = Math.round((height * BOX.width) / BOX.height);
      const layer = mark.clone().resize(width, height, Jimp.RESIZE_BICUBIC);
      canvas.composite(silhouette === undefined ? layer : flatten(layer, silhouette),
        Math.round((size - width) / 2), Math.round((size - height) / 2));
    }
    // iOS rejects an app icon with an alpha channel, so opaque targets are written as RGB.
    if (opaque) canvas.opaque().colorType(2);
    await canvas.writeAsync(path.join(ASSETS, file));
    console.log(`wrote     assets/${file}  ${size}x${size}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
