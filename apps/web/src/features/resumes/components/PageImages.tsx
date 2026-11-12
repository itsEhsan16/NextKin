'use client';

import type { PreviewPage } from '@nextkin/shared/schemas/resumePreview';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { browserStorageUrl } from '@/lib/storageUrl';
import { buttonClass } from '@/ui/Button';

/**
 * A resume's typeset pages (toreview §111): images of the PDF the download holds, compiled by
 * LaTeX on the server, one under the other. Each page fades in once loaded. While a newer version
 * is typeset the earlier pages stay up under an "Updating…" label.
 */
export function PageImages({
  pages,
  stale = false,
  title,
  className,
}: {
  pages: PreviewPage[];
  /** The document's name, so each page's alt says whose page it is (RS-31). */
  title?: string;
  stale?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('relative flex flex-col gap-4', className)}>
      {stale ? (
        <span
          role="status"
          className="absolute right-3 top-3 z-raised rounded-full border border-border-default bg-surface-card px-2.5 py-0.5 text-body-s text-text-secondary shadow-popover"
        >
          Updating…
        </span>
      ) : null}
      {pages.map((page, i) => (
        <Page
          key={page.url}
          page={page}
          label={`${title ? `${title}, page` : 'Page'} ${i + 1} of ${pages.length}`}
          dim={stale}
        />
      ))}
    </div>
  );
}

function Page({ page, label, dim }: { page: PreviewPage; label: string; dim: boolean }) {
  const [loaded, setLoaded] = useState(false);
  // A page that fails to load says so in its own place, which keeps its size (redesign R6b,
  // audit RS-28); trying again asks the browser for the image anew.
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <div
      className="w-full bg-surface-card shadow-card"
      // The page's own proportions hold its place before the image arrives.
      style={{
        aspectRatio: page.width && page.height ? `${page.width} / ${page.height}` : '8.5 / 11',
      }}
    >
      {failed ? (
        <div
          role="status"
          className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center"
        >
          <p className="text-body-m text-text-secondary">This page didn’t load.</p>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setLoaded(false);
              setAttempt((n) => n + 1);
            }}
            className={buttonClass({ variant: 'secondary', size: 'sm' })}
          >
            Try again
          </button>
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element -- a presigned page image; nothing for next/image to optimise */
        <img
          key={attempt}
          src={browserStorageUrl(page.url)}
          alt={label}
          width={page.width || undefined}
          height={page.height || undefined}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            'block h-full w-full select-none transition-opacity duration-base ease-standard',
            loaded ? (dim ? 'opacity-60' : 'opacity-100') : 'opacity-0',
          )}
          draggable={false}
        />
      )}
    </div>
  );
}
