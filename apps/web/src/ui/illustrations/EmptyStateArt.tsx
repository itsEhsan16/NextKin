/**
 * The clay desk objects (`public/illustrations/v2/match-*.webp`), now the art of the empty states
 * (2026-11-13: Home's match cards went back to the board's people, and these moved here). One per
 * kind of emptiness, so a page reads as intended rather than unfinished (`toreview.md` §85).
 */
const OBJECTS = {
  chart: { n: 1, w: 560, h: 370 },
  palette: { n: 2, w: 500, h: 560 },
  monitor: { n: 3, w: 535, h: 560 },
  notebook: { n: 4, w: 560, h: 449 },
  headphones: { n: 5, w: 560, h: 489 },
  briefcase: { n: 6, w: 560, h: 396 },
  rocket: { n: 7, w: 386, h: 560 },
  notes: { n: 8, w: 560, h: 529 },
  tablet: { n: 9, w: 560, h: 518 },
  globe: { n: 10, w: 370, h: 560 },
  trophy: { n: 11, w: 465, h: 560 },
} as const;

export type EmptyStateObject = keyof typeof OBJECTS;

/** Decorative: `StateView` hides its `art` from screen readers, and the title says it all. */
export function EmptyStateArt({ object }: { object: EmptyStateObject }) {
  const { n, w, h } = OBJECTS[object];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a fixed, pre-sized WebP; nothing for next/image to optimise
    <img
      src={`/illustrations/v2/match-${n}.webp`}
      alt=""
      width={w}
      height={h}
      draggable={false}
      decoding="async"
      className="h-24 w-auto select-none object-contain"
    />
  );
}
