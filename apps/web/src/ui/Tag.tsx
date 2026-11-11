import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type TagTone = 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';

/**
 * The tone pairs bound on the Applications board (286:1234), which the Resumes board draws raw.
 * `info` is the Documents board's Cover Letter pair (286:2142).
 *
 * The status tones read the feedback tokens (redesign R2): same tints, text one step darker. The
 * board's pairs were 3.00–3.95:1 for success, info and danger and 3.27 for warning, under the
 * 4.5:1 V2 §8.7 asks of text; each now passes (02-tokens §3.5).
 */
const TONE: Record<TagTone, string> = {
  brand: 'bg-brand-100 text-brand-600',
  info: 'bg-feedback-info-surface text-feedback-info-text',
  success: 'bg-feedback-success-surface text-feedback-success-text',
  warning: 'bg-feedback-warning-surface text-feedback-warning-text',
  danger: 'bg-feedback-danger-surface text-feedback-danger-text',
  neutral: 'bg-neutral-100 text-text-secondary',
};

export type TagProps = {
  tone: TagTone;
  /** `rounded` in a list row (304:3146), `pill` where a card's header wears it (304:3269). */
  shape?: 'rounded' | 'pill';
  children: ReactNode;
  className?: string;
};

/**
 * A short coloured label: where an application stands (286:1337 and on), what kind of resume a
 * document is and what state it is in (304:3146 and on). One set of tones for both pages.
 */
export function Tag({ tone, shape = 'rounded', children, className }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap text-caption-m font-semibold',
        shape === 'pill' ? 'rounded-full px-2.5 py-1' : 'rounded-sm px-2 py-0.5',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
