import { sizes } from '@/theme/tokens';

import { FIGMA_REFS } from './figmaRefs.generated';

/** The two pages the Figma file draws every screen on. */
export type Board = 520 | 390;

export type FigmaRef = {
  /** Figma node id, e.g. "1:2189". */
  id: string;
  /** Artboard name as it reads in the file. */
  name: string;
  /** Which page this render came from — "Mobile App" (520) or "Mobile 2" (390). */
  frameWidth: Board;
  /** Frame height in artboard px. */
  frameHeight: number;
  /** The exported PNG's own box, which exceeds the frame when the node has an outer effect. */
  renderWidth: number;
  renderHeight: number;
  source: number;
};

export { FIGMA_REFS };

export type OverlayGeometry = {
  width: number;
  height: number;
  left: number;
  top: number;
};

/**
 * Places a render so its *frame* lines up with the device screen, not its bounding box.
 *
 * Home's drop shadow makes its PNG 640×1478 around a 520×1358 frame; without this the whole
 * overlay sits 60 artboard px off in both axes and every measurement reads wrong.
 *
 * The frame is fitted to the screen regardless of which board it came from, so a 390 render and
 * its 520 twin land in the same place — which is the point, since geometry is identical between
 * them and only the type differs. On a 390dp phone the 390 render is 1:1 and the comparison is
 * pixel for pixel.
 */
export function overlayGeometryFor(ref: FigmaRef, screenWidth: number): OverlayGeometry {
  const scale = Math.min(screenWidth, sizes.designWidth) / ref.frameWidth;
  const overscanX = (ref.renderWidth - ref.frameWidth) / 2;
  const overscanY = (ref.renderHeight - ref.frameHeight) / 2;

  return {
    width: ref.renderWidth * scale,
    height: ref.renderHeight * scale,
    left: -overscanX * scale,
    top: -overscanY * scale,
  };
}
