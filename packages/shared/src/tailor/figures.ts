/**
 * "Add the result" by picking (owner, 2026-11-02, toreview §149): what improved, then roughly how
 * much. The person picks both; nothing is chosen for them, and the AI never picks a value. The
 * clause is built here, by code, so the line reads the same wherever it's shown.
 */

export type FigureKindKey = 'faster' | 'cheaper' | 'users' | 'errors';

export type FigureKind = {
  key: FigureKindKey;
  /** The chip: "Made it faster". */
  label: string;
  /** The sizes on offer, as the line will say them. */
  sizes: readonly string[];
  /** "cutting the time it took by about 25%". */
  clause: (size: string) => string;
};

const PERCENTS = ['10%', '25%', '50%'] as const;

export const FIGURE_KINDS: readonly FigureKind[] = [
  {
    key: 'faster',
    label: 'Made it faster',
    sizes: [...PERCENTS, '75%'],
    clause: (size) => `cutting the time it took by about ${size}`,
  },
  {
    key: 'cheaper',
    label: 'Saved money',
    sizes: PERCENTS,
    clause: (size) => `cutting costs by about ${size}`,
  },
  {
    key: 'users',
    label: 'Reached more people',
    sizes: ['100+', '1,000+', '10,000+', '100,000+'],
    clause: (size) => `reaching ${size} users`,
  },
  {
    key: 'errors',
    label: 'Fewer errors or bugs',
    sizes: PERCENTS,
    clause: (size) => `reducing errors by about ${size}`,
  },
];

export const figureKind = (key: FigureKindKey): FigureKind | undefined =>
  FIGURE_KINDS.find((kind) => kind.key === key);

/** The bullet with its result: "Built X, cutting costs by about 25%." */
export function lineWithFigure(line: string, clause: string): string {
  return `${line.trim().replace(/[.;,:\s]+$/, '')}, ${clause}.`;
}

/** The finished line for a pick, or null until both parts are picked. */
export function pickedLine(
  line: string,
  kind: FigureKindKey | null,
  size: string | null,
): string | null {
  const picked = kind ? figureKind(kind) : undefined;
  if (!picked || !size || !picked.sizes.includes(size)) return null;
  return lineWithFigure(line, picked.clause(size));
}
