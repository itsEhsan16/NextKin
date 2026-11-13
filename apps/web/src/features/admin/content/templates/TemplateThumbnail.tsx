import type { TemplateLayout } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';

/** A bar's fill, from the board's neutral and brand ramps. */
const TONE = {
  n200: 'bg-neutral-200',
  n300: 'bg-neutral-300',
  n400: 'bg-neutral-400',
  n500: 'bg-neutral-500',
  n600: 'bg-neutral-600',
  n700: 'bg-neutral-700',
  n800: 'bg-neutral-800',
  white: 'bg-neutral-0',
  b50: 'bg-brand-50',
  b100: 'bg-brand-100',
  b500: 'bg-brand-500',
  b600: 'bg-brand-600',
} as const;

type Tone = keyof typeof TONE;
type Shape = 'bar' | 'square' | 'circle';

/** `[left, top, width, height, tone, shape]`: one mark on the page, in the board's pixels. */
type Bar = readonly [number, number, number, number, Tone, Shape?];

const SHAPE: Record<Shape, string> = {
  bar: 'rounded-hairline',
  square: '',
  circle: 'rounded-full',
};

/** A run of text lines `step` apart, each `h` tall, at the board's widths. */
const lines = (
  left: number,
  top: number,
  widths: readonly number[],
  step = 6,
  h = 3,
  tone: Tone = 'n200',
): Bar[] => widths.map((w, i): Bar => [left, top + i * step, w, h, tone]);

/** A Jake section: a 4px heading, a hairline rule, then the lines. */
const jakeSection = (top: number, widths: number[]): Bar[] => [
  [11, top, 40, 4, 'n700'],
  [11, top + 7, 136, 1, 'n300', 'square'],
  ...lines(11, top + 12, widths),
];

const modernSection = (top: number, widths: number[]): Bar[] => [
  [55, top, 36, 4, 'b600'],
  ...lines(55, top + 9, widths),
];

const compactSection = (top: number, widths: number[]): Bar[] => [
  [9, top, 30, 3, 'n700'],
  ...lines(9, top + 6, widths, 5, 2),
];

const executiveSection = (top: number, widths: number[], dated: boolean): Bar[] => [
  [11, top, 44, 4, 'n700'],
  ...(dated ? [[109, top, 38, 3, 'n400'] as Bar] : []),
  ...lines(11, top + (dated ? 9 : 8), widths),
];

const classicSection = (top: number, widths: number[]): Bar[] => [
  [11, top, 30, 4, 'n600'],
  ...lines(47, top, widths),
];

const COMPACT_LINES = [140, 129, 136, 109, 123, 133];

/** Each layout's page as the board draws it (Figma 407:2080, 2126, 2176, 2233, 2283, 2327). */
const PAGES: Record<TemplateLayout, Bar[]> = {
  jake: [
    [51, 13, 56, 7, 'n800'],
    [37, 24, 84, 3, 'n400'],
    ...jakeSection(37, [136, 125, 132, 106]),
    ...jakeSection(77, [136, 125, 132]),
    ...jakeSection(111, [136, 125, 132, 106]),
    ...jakeSection(151, [136, 125]),
  ],
  modern: [
    [-1, -1, 46, 212, 'b50', 'square'],
    [7, 13, 30, 30, 'b100', 'circle'],
    ...lines(7, 53, [30, 28, 29, 23], 6, 3, 'b100'),
    ...lines(7, 89, [30, 28, 29, 23, 26], 6, 3, 'b100'),
    [55, 13, 70, 8, 'n800'],
    [55, 25, 50, 3, 'b500'],
    ...modernSection(41, [92, 85, 89, 72]),
    ...modernSection(81, [92, 85, 89, 72]),
    ...modernSection(121, [92, 85, 89]),
  ],
  elegant: [
    [44, 15, 70, 6, 'n800'],
    [54, 25, 50, 3, 'n400'],
    [63, 33, 32, 1, 'n500', 'square'],
    [11, 45, 40, 3, 'n600'],
    ...lines(11, 53, [64, 59, 62, 50, 56, 61, 45, 64], 7),
    [85, 45, 40, 3, 'n600'],
    ...lines(85, 53, [62, 57, 60, 48], 7),
    [85, 87, 40, 3, 'n600'],
    ...lines(85, 95, [62, 57, 60], 7),
    [11, 127, 40, 3, 'n600'],
    ...lines(11, 135, [136, 125, 132, 106, 120, 129], 7),
  ],
  compact: [
    [9, 9, 60, 6, 'n800'],
    [9, 18, 100, 2, 'n400'],
    ...compactSection(27, COMPACT_LINES),
    ...compactSection(68, COMPACT_LINES),
    ...compactSection(109, COMPACT_LINES.slice(0, 5)),
    ...compactSection(145, COMPACT_LINES.slice(0, 4)),
  ],
  executive: [
    [-1, -1, 160, 42, 'n800', 'square'],
    [11, 11, 64, 7, 'white'],
    [11, 23, 90, 3, 'n400'],
    ...executiveSection(53, [136, 125, 132], false),
    ...executiveSection(85, [136, 125, 132, 106], true),
    ...executiveSection(127, [136, 125, 132], true),
  ],
  classic: [
    [11, 13, 64, 7, 'n700'],
    [11, 24, 110, 3, 'n400'],
    [11, 32, 136, 2, 'n600', 'square'],
    ...classicSection(41, [100, 92, 97]),
    ...classicSection(69, [100, 92, 97, 78]),
    ...classicSection(103, [100, 92, 97]),
    ...classicSection(131, [100, 92, 97]),
  ],
};

/**
 * A sketch of a template's page, as each card's thumbnail draws it (Figma 407:2079): a grey tray
 * with the page standing at its foot, and the header, section headings and text lines in the
 * template's arrangement. Not a render of the template. Decorative. An archived template's page
 * is dimmed, as the board dims Classic's.
 */
export function TemplateThumbnail({
  layout,
  dimmed = false,
}: {
  layout: TemplateLayout;
  dimmed?: boolean;
}) {
  return (
    <div
      aria-hidden
      className="flex h-[236px] items-end justify-center overflow-hidden rounded-admin-md border border-neutral-100 bg-neutral-50 pt-5"
    >
      <div
        data-testid="template-page"
        className={cn(
          // The board's page shadow is Untitled UI's shadow-lg, which no token holds yet; the
          // modal's is the nearest (toreview, shared needs).
          'relative h-[226px] w-[160px] shrink-0 overflow-hidden rounded-xs border border-neutral-200 bg-surface-card shadow-lg',
          dimmed && 'opacity-60',
        )}
      >
        {PAGES[layout].map(([left, top, width, height, tone, shape = 'bar'], i) => (
          <span
            key={i}
            style={{ left, top, width, height }}
            className={cn('absolute', TONE[tone], SHAPE[shape])}
          />
        ))}
      </div>
    </div>
  );
}
