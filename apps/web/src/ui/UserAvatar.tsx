'use client';

import { cn } from '@/lib/cn';
import { initialsOf } from '@/lib/format';
import { browserStorageUrl } from '@/lib/storageUrl';
import { resolveImageSrc } from '@/ui/assets';

export type UserAvatarProps = {
  name: string;
  /** Remote URL or `asset:` key; without one, the initials stand in. */
  avatarUrl?: string;
  /** Size and shape — each board draws its own. */
  className?: string;
};

/** Shows the photo once it has arrived (or at once, if it already had). */
function markLoaded(img: HTMLImageElement | null) {
  if (img?.complete && img.naturalWidth > 0) img.setAttribute('data-loaded', '');
}

/**
 * The signed-in user's photo, or their initials on a brand tint. Decorative: the control around
 * it, or the name beside it, is what a screen reader announces.
 *
 * The photo sits on the same tint and fades in once it has loaded (`toreview.md` §84), rather than
 * leaving an empty gap where the circle was and then appearing all at once.
 */
export function UserAvatar({ name, avatarUrl, className }: UserAvatarProps) {
  const resolved = resolveImageSrc(avatarUrl);
  // A presigned photo on local storage, from a page opened through a tunnel (toreview §131.9).
  const src = resolved ? browserStorageUrl(resolved) : undefined;

  if (src) {
    return (
      <span
        aria-hidden
        className={cn('relative block shrink-0 overflow-hidden bg-surface-brand', className)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 46px photo, nothing to optimise */}
        <img
          ref={markLoaded}
          src={src}
          alt=""
          onLoad={(event) => event.currentTarget.setAttribute('data-loaded', '')}
          className="size-full object-cover opacity-0 transition-opacity duration-fast ease-standard data-loaded:opacity-100"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center bg-surface-brand text-body-s font-semibold text-text-brand',
        className,
      )}
    >
      {name ? initialsOf(name) : ''}
    </span>
  );
}
