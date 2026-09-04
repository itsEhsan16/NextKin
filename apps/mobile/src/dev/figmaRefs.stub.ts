import type { FigmaRef } from './figmaRefs';

/**
 * Production stand-in for figmaRefs.generated.ts, swapped in by metro.config.js.
 *
 * The generated module `require()`s 51 artboard PNGs (~3MB) — both Figma pages. They exist to be
 * measured against during development and have no business in a release bundle, so production
 * resolves this instead and `FigmaOverlay` — already `__DEV__`-gated — renders nothing.
 */
export const FIGMA_REFS: readonly FigmaRef[] = [];
