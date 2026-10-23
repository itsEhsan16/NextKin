/**
 * Token budgets (ImBackendImplementationPlan P6-10). Every stage has a ceiling on what it sends;
 * an input over it is cut deterministically — the same input always becomes the same prompt — at a
 * paragraph, line or word boundary, never mid-word, and the call records that it was truncated.
 *
 * The estimate is conservative (about 3.5 characters per token for English, fewer for symbols), so
 * a budget is a ceiling the real count stays under. The exact count is what the provider reports.
 */
const CHARS_PER_TOKEN = 3.5;

export const estimateTokens = (text: string): number => Math.ceil(text.length / CHARS_PER_TOKEN);

export interface Budgeted {
  text: string;
  truncated: boolean;
  estimatedTokens: number;
}

export function fitToBudget(text: string, maxTokens: number): Budgeted {
  const normalised = text.replace(/\r\n/g, '\n');
  if (estimateTokens(normalised) <= maxTokens) return { text: normalised, truncated: false, estimatedTokens: estimateTokens(normalised) };
  const limit = Math.floor(maxTokens * CHARS_PER_TOKEN);
  const head = normalised.slice(0, limit);
  // Prefer the last paragraph break, then line, then word, in the final quarter of the window.
  const floor = Math.floor(limit * 0.75);
  const cut = [head.lastIndexOf('\n\n'), head.lastIndexOf('\n'), head.lastIndexOf(' ')].find((i) => i >= floor) ?? limit;
  const kept = head.slice(0, cut).trimEnd();
  return { text: kept, truncated: true, estimatedTokens: estimateTokens(kept) };
}
