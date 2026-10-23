/**
 * Why an export cannot go ahead yet (V2 §7.9, §7.1, §15 risk 2), and what the apps say for each.
 * The server sends the reason in the error's details; the client's ExportBlockedError carries it.
 */
export type ExportBlock = 'accuracy' | 'review' | 'email' | 'incomplete';

export const EXPORT_BLOCK_MESSAGE: Record<ExportBlock, string> = {
  accuracy: 'Confirm this version is accurate before you download it.',
  review: 'Finish checking what we guessed before you download this resume.',
  email: 'Verify your email address before your first download.',
  // The server's message names what is missing (toreview §124); this is the fallback.
  incomplete: 'Finish the resume before you download it: it needs your name and at least one section.',
};
