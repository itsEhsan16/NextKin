import { sizes } from '@/theme/tokens';

import { FIGMA_REFS } from './figmaRefs.generated';

export type FigmaRef = {
  /** Figma node id, e.g. "1:2189". */
  id: string;
  /** Artboard name as it reads in the file. */
  name: string;
  /** Frame height in artboard px; every frame is `sizes.designWidth` (520) wide. */
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
 */
export function overlayGeometryFor(ref: FigmaRef, screenWidth: number): OverlayGeometry {
  const scale = Math.min(screenWidth, sizes.designWidth) / sizes.designWidth;
  const overscanX = (ref.renderWidth - sizes.designWidth) / 2;
  const overscanY = (ref.renderHeight - ref.frameHeight) / 2;

  return {
    width: ref.renderWidth * scale,
    height: ref.renderHeight * scale,
    left: -overscanX * scale,
    top: -overscanY * scale,
  };
}
