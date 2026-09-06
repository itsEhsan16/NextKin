/**
 * Why the reader arrived at the plan screen. V2 §13.5 asks an upsell to name the limit that was
 * actually reached rather than opening on a generic pitch, so every gated control passes its own
 * reason and the screen leads with that line.
 */
export type UpgradeReason =
  | 'docx'
  | 'generations'
  | 'cover_letters'
  | 'ats_checks'
  | 'saved_jobs'
  | 'versions'
  | 'assistant'
  | 'interview';

export const UPGRADE_REASONS: readonly UpgradeReason[] = [
  'docx',
  'generations',
  'cover_letters',
  'ats_checks',
  'saved_jobs',
  'versions',
  'assistant',
  'interview',
] as const;

export const isUpgradeReason = (value: string): value is UpgradeReason =>
  (UPGRADE_REASONS as readonly string[]).includes(value);
