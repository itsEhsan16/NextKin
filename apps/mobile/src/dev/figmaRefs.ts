import { sizes } from '@/theme/tokens';

import { FIGMA_REFS } from './figmaRefs.generated';

/**
 * The widths the Figma file draws on: the two pages every screen exists on, plus the onboarding
 * and auth board, which is neither. Those sections are drawn phone-sized rather than as
 * presentation frames, and the first two of the seven a fraction narrower again — kept exact here
 * rather than normalised, so `overlayGeometryFor` centres each render's own drop-shadow
 * overscan instead of being 4 artboard px out on two screens.
 */
export type Board = 520 | 390 | 422.66 | 414.67;

export type FigmaRef = {
  /** Figma node id, e.g. "1:2189". */
  id: string;
  /** Artboard name as it reads in the file. */
  name: string;
  /** The board this render came from — "Mobile App" (520), "Mobile 2" (390), or auth. */
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
