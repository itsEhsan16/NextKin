import { cn } from '@/lib/cn';
import { BookmarkIcon } from '@/ui/icons';
import { iconButton } from '@/ui/iconButton';
import { BUTTON_VARIANT } from '@/ui/buttonStyles';

export type SaveButtonProps = {
  saved: boolean;
  onToggle: () => void;
  /** `icon` 24px, `card` the redrawn list card's 32px with an 18px glyph (719:49), `labeled` the detail card's. */
  variant?: 'icon' | 'card' | 'labeled';
  pending?: boolean;
};

/**
 * The bookmark toggle — an icon-only button on every job card (304:2493) and the detail card's
 * "Save Job" (304:2778). Only one bookmark glyph is drawn on the board: a single filled path
 * whose ribbon-outline look comes from its own geometry, not from a stroke/fill distinction —
 * there's no separate "solid" variant to swap to for the saved state. The saved state is a
 * colour change instead (brand tint vs. tertiary grey), the same distinguishing mechanism the
 * board's own green match badge and indigo active tab already use elsewhere on this page.
 */
export function SaveButton({
  saved,
  onToggle,
  variant = 'icon',
  pending = false,
}: SaveButtonProps) {
  const icon = (
    <BookmarkIcon
      className={cn(
        variant === 'card' ? 'size-4.5' : 'size-4',
        saved ? 'text-brand-600' : variant === 'card' ? 'text-text-primary' : 'text-text-tertiary',
      )}
    />
  );

  if (variant !== 'labeled') {
    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? 'Unsave job' : 'Save job'}
        // `pointer-events-auto`: this sits inside `JobCard`'s `pointer-events-none` content
        // wrapper (so clicks on empty card space fall through to the "select" button beneath),
        // and needs its own opt back in to stay clickable. A no-op wherever it isn't nested that
        // way (the detail card's `labeled` variant below).
        className={cn(
          iconButton,
          'pointer-events-auto text-text-tertiary hover:text-text-brand disabled:opacity-60',
        )}
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={saved}
      className={cn(
        BUTTON_VARIANT.secondary,
        'flex h-control-lg w-full gap-2 rounded-md text-body-l font-semibold',
      )}
    >
      {icon}
      {saved ? 'Saved' : 'Save Job'}
    </button>
  );
}
