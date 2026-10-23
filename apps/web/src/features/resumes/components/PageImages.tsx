'use client';

import type { PreviewPage } from '@nextkin/shared/schemas/resumePreview';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { browserStorageUrl } from '@/lib/storageUrl';

/**
 * A resume's typeset pages (toreview §111): images of the PDF the download holds, compiled by
 * LaTeX on the server, one under the other. Each page fades in once loaded. While a newer version
 * is typeset the earlier pages stay up under an "Updating…" label.
 */
export function PageImages({
  pages,
  stale = false,
  className,
}: {
  pages: PreviewPage[];
  stale?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('relative flex flex-col gap-4', className)}>
      {stale ? (
        <span
          role="status"
          className="absolute right-3 top-3 z-10 rounded-full border border-border-default bg-surface-card px-2.5 py-0.5 text-body-s text-text-secondary shadow-popover"
        >
          Updating…
        </span>
      ) : null}
      {pages.map((page, i) => (
        <Page key={page.url} page={page} label={`Page ${i + 1} of ${pages.length}`} dim={stale} />
      ))}
    </div>
  );
}

function Page({ page, label, dim }: { page: PreviewPage; label: string; dim: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="w-full bg-surface-card shadow-popover"
      // The page's own proportions hold its place before the image arrives.
      style={{
        aspectRatio: page.width && page.height ? `${page.width} / ${page.height}` : '8.5 / 11',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a presigned page image; nothing for next/image to optimise */}
      <img
        src={browserStorageUrl(page.url)}
        alt={label}
        width={page.width || undefined}
        height={page.height || undefined}
        onLoad={() => setLoaded(true)}
        className={cn(
          'block h-full w-full select-none transition-opacity duration-base ease-standard',
          loaded ? (dim ? 'opacity-60' : 'opacity-100') : 'opacity-0',
        )}
        draggable={false}
      />
    </div>
  );
}
