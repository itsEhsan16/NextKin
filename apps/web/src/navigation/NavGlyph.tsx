import type { ComponentType, SVGProps } from 'react';

/**
 * A column around a glyph, with the glyph scaled to fill its width. The sidebar board (711:2)
 * draws its nav icons on a common 24px *width* and lets the height run free (Resumes is 22x22,
 * Jobs 24x14), so each takes the column's width and keeps its own aspect. These are wide, short
 * glyphs, and the owner stepped them up from 20 to 24, 28 and then 40 (2026-10-08). The panel
 * column is 40, with heights capped at 28 so the taller glyphs (Resumes, Settings, Home) keep 6px
 * of air inside a 40px row (the SVG's default `meet` shrinks them to fit, never stretches). The
 * rail's squares are 40 too, so there the column is 32 (4 + 32 + 4) and eases between the two with
 * the collapse.
 */
export function NavGlyph({ Icon }: { Icon: ComponentType<SVGProps<SVGSVGElement>> }) {
  return (
    <span className="flex w-10 shrink-0 items-center justify-center transition-[width] duration-base ease-standard rail:w-8 [&>svg]:h-auto [&>svg]:max-h-7 [&>svg]:w-10 [&>svg]:transition-[width] [&>svg]:duration-base [&>svg]:ease-standard rail:[&>svg]:w-8">
      <Icon />
    </span>
  );
}
