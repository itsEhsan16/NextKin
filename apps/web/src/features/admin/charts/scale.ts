export type Scale = { ticks: number[]; top: number };

/**
 * A chart's gridlines and ceiling. The step is round (1, 2 or 5 × a power of ten) and chosen to
 * give about `lines` lines. The ceiling is the next line above the data, unless the data's top sits
 * just past a line (within a tenth of a step), in which case that line stays the ceiling and the
 * tallest bar overshoots it a little: the board keeps 800 at the plot's top under an 812-run day
 * and lets the bar rise 3px past it (Figma 395:628), and draws 0–1.5k under a 1,490 bucket
 * (396:653). Callers draw against `top`, so such a bar is a little over 100% tall.
 */
export function chartScale(max: number, lines = 4): Scale {
  if (max <= 0) return { ticks: [0], top: 1 };
  const power = 10 ** Math.floor(Math.log10(max / lines));
  const candidates = [1, 2, 5, 10, 20].map((m) => m * power);
  const step = candidates.reduce((best, s) =>
    Math.abs(Math.floor(max / s) - lines) < Math.abs(Math.floor(max / best) - lines) ? s : best,
  );
  const below = Math.floor(max / step) * step;
  const top = below > 0 && max - below < step / 10 ? below : below + step;
  const ticks: number[] = [];
  for (let tick = 0; tick <= top + step / 1000; tick += step) ticks.push(tick);
  return { ticks, top };
}
