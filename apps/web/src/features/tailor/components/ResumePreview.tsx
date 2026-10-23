'use client';

import type { ResumeContent } from '@nextkin/shared/models';
import { useResume, useResumeContent, useResumePreview } from '@nextkin/shared/queries';
import { resumeTextView } from '@nextkin/shared/scoring/resumeDiff';
import { useMemo, useRef, useState } from 'react';

import { PageImages } from '@/features/resumes/components/PageImages';
import { ResumeSheet } from '@/features/resumes/components/ResumeSheet';
import { cn } from '@/lib/cn';
import { cardSurface } from '@/ui/Card';
import { iconButton } from '@/ui/iconButton';
import { ChevronLeft, Expand01, Minus, Plus, iconSize } from '@/ui/lineIcons';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { TextView } from './TextView';

const ZOOMS = [75, 100, 125] as const;
type View = 'preview' | 'text';

const control = cn(
  iconButton,
  'size-8 text-text-secondary not-disabled:not-aria-disabled:hover:bg-surface-card not-disabled:not-aria-disabled:hover:text-text-primary not-disabled:not-aria-disabled:hover:shadow-card disabled:opacity-40',
);
const box =
  'flex h-10 items-center gap-0.5 rounded-full bg-surface-muted p-1 text-body-s font-medium text-text-secondary';

/**
 * The new resume (toreview §121, from the owner's mockup): Preview, the typeset page the download
 * holds (toreview §111), or Text view, the resume as text with the AI's changes marked. Zoom and
 * the page count sit above it, beside a full-screen button.
 */
export function ResumePreview({
  resumeId,
  name,
  pages: estimated,
  baseResumeId,
}: {
  resumeId: string;
  name: string;
  pages: number;
  baseResumeId?: string;
}) {
  const content = useResumeContent(resumeId);
  const resume = useResume(resumeId);
  const preview = useResumePreview(resumeId, resume.data?.currentVersionId);
  const typeset = preview.data?.pages.length ? preview.data : undefined;
  const pages = typeset?.pageCount ?? estimated;
  const [view, setView] = useState<View>('preview');
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(100);
  const [page, setPage] = useState(1);
  const frame = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLElement>(null);
  const data = content.data;
  // The query types its body as any document; a tailored run always writes a resume.
  const body = data?.kind === 'resume' ? (data as ResumeContent) : undefined;
  const base = useResumeContent(baseResumeId ?? '');
  const baseBody = base.data?.kind === 'resume' ? (base.data as ResumeContent) : undefined;
  const text = useMemo(() => (body ? resumeTextView(baseBody, body) : null), [body, baseBody]);
  const zoomAt = ZOOMS.indexOf(zoom);
  const go = (next: number) =>
    frame.current?.scrollTo({ top: (next - 1) * frame.current.clientHeight, behavior: 'smooth' });
  const fullScreen = () => void shell.current?.requestFullscreen?.().catch(() => undefined);

  return (
    <section
      ref={shell}
      aria-label="Your new resume"
      className={cn(
        cardSurface,
        'flex min-h-120 flex-col gap-5 bg-neutral-50 p-6 lg:h-full lg:min-h-0',
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <SegmentedControl
          label="How to show it"
          value={view}
          onChange={setView}
          segments={[
            { id: 'preview', label: 'Preview' },
            { id: 'text', label: 'Text view' },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <div className={box}>
            <button
              type="button"
              aria-label="Zoom out"
              disabled={zoomAt === 0}
              onClick={() => setZoom(ZOOMS[zoomAt - 1] ?? zoom)}
              className={control}
            >
              <Minus aria-hidden className={iconSize.sm} />
            </button>
            <span className="w-11 text-center tabular-nums">{zoom}%</span>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={zoomAt === ZOOMS.length - 1}
              onClick={() => setZoom(ZOOMS[zoomAt + 1] ?? zoom)}
              className={control}
            >
              <Plus aria-hidden className={iconSize.sm} />
            </button>
          </div>
          <div className={box}>
            <button
              type="button"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => go(page - 1)}
              className={control}
            >
              <ChevronLeft aria-hidden className={iconSize.sm} />
            </button>
            <span className="px-1 tabular-nums">
              {page} / {pages}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={page >= pages}
              onClick={() => go(page + 1)}
              className={control}
            >
              <ChevronLeft aria-hidden className={cn(iconSize.sm, 'rotate-180')} />
            </button>
          </div>
          <div className={box}>
            <button type="button" aria-label="Full screen" onClick={fullScreen} className={control}>
              <Expand01 aria-hidden className={iconSize.sm} />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={frame}
        onScroll={(event) => {
          const node = event.currentTarget;
          setPage(Math.min(pages, Math.round(node.scrollTop / node.clientHeight) + 1));
        }}
        className="mx-auto min-h-0 w-full max-w-170 flex-1 overflow-y-auto overflow-x-hidden motion-safe:scroll-smooth [scrollbar-width:thin]"
      >
        <div
          className="origin-top rounded-sm bg-surface-card shadow-popover transition-transform duration-base ease-standard"
          style={{ transform: `scale(${zoom / 100})` }}
        >
          {view === 'text' && text ? (
            <TextView sections={text} />
          ) : typeset ? (
            <PageImages pages={typeset.pages} stale={typeset.stale} />
          ) : body ? (
            <ResumeSheet name={name} body={body} />
          ) : content.isError ? (
            <StateView
              tone="danger"
              title="We couldn’t load this resume"
              message="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => void content.refetch()}
            />
          ) : (
            <Skeleton className="aspect-[600/780] w-full rounded-md" />
          )}
        </div>
      </div>
    </section>
  );
}
