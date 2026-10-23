'use client';

import type { ResumeDocument } from '@nextkin/shared/models';
import { useResumePreview } from '@nextkin/shared/queries';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { PageImages } from '@/features/resumes/components/PageImages';
import { cn } from '@/lib/cn';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Skeleton } from '@/ui/Skeleton';

import { PAGE_HEIGHT, PAGE_WIDTH, ResumePage } from './ResumePage';

/**
 * The right half of the editor (toreview §124; EDIT 01, 866:392). "Live preview" redraws the page on every keystroke and
 * marks where each US Letter page ends; "PDF" shows the typeset pages of the last save — exactly
 * what the download holds — and says so while a newer save is being typeset.
 */

type Tab = 'live' | 'pdf';

function useFitScale() {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const fit = () => setScale(Math.min(1.1, Math.max(0.3, (node.clientWidth - 40) / PAGE_WIDTH)));
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { box, scale };
}

function LivePage({ doc }: { doc: ResumeDocument }) {
  const { box, scale } = useFitScale();
  const page = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(PAGE_HEIGHT);
  useEffect(() => {
    const node = page.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setHeight(Math.max(PAGE_HEIGHT, node.offsetHeight)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const pages = Math.max(1, Math.ceil(height / PAGE_HEIGHT));
  const sheet = pages * PAGE_HEIGHT;

  return (
    <div
      ref={box}
      className="flex min-h-0 flex-1 justify-center overflow-y-auto overflow-x-hidden px-5 py-5 [scrollbar-width:thin]"
    >
      <div
        style={{ width: PAGE_WIDTH * scale, height: sheet * scale }}
        className="relative shrink-0"
      >
        <div
          style={{ transform: `scale(${scale})`, width: PAGE_WIDTH, height: sheet }}
          className="relative origin-top-left bg-surface-card shadow-popover"
        >
          <div ref={page}>
            <ResumePage doc={doc} />
          </div>
          {Array.from({ length: pages - 1 }, (_, i) => (
            <div
              key={i}
              aria-hidden
              style={{ top: (i + 1) * PAGE_HEIGHT }}
              className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-brand-100"
            >
              <span className="absolute right-2 top-1 rounded-sm bg-surface-brand px-2 py-0.5 font-sans text-body-m font-semibold text-text-brand">
                Page {i + 2}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PdfPages({
  resumeId,
  versionId,
  saving,
}: {
  resumeId: string;
  versionId: string;
  saving: boolean;
}) {
  const preview = useResumePreview(resumeId, versionId);
  const data = preview.data;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 [scrollbar-width:thin]">
      {(saving || data?.status === 'pending') && (
        <p className="mb-3 rounded-md bg-surface-brand px-3 py-2 text-body-s text-text-brand">
          {saving
            ? 'Saving your latest changes — the typeset pages follow.'
            : 'Typesetting your latest save…'}
        </p>
      )}
      {data?.status === 'failed' && (
        <p
          role="alert"
          className="mb-3 rounded-md bg-warning-50 px-3 py-2 text-body-s text-warning-text"
        >
          We couldn’t typeset this version. The live view is still accurate; try again after your
          next change.
        </p>
      )}
      {data?.status === 'structured' && (
        <p className="mb-3 rounded-md bg-warning-50 px-3 py-2 text-body-s text-warning-text">
          This resume has guesses to check first, so there are no typeset pages yet.
        </p>
      )}
      {data && data.pages.length > 0 ? (
        <div className="mx-auto max-w-[720px]">
          <PageImages pages={data.pages} stale={Boolean(data.stale)} />
        </div>
      ) : (
        data?.status !== 'failed' &&
        data?.status !== 'structured' && (
          <Skeleton className="mx-auto aspect-[816/1056] w-full max-w-[720px] rounded-md" />
        )
      )}
    </div>
  );
}

export function PreviewPane({
  doc,
  saving,
  toolbar,
  className,
}: {
  doc: ResumeDocument;
  saving: boolean;
  /** At the toolbar's right: the template switch (EDIT 01, 866:400). */
  toolbar?: ReactNode;
  className?: string;
}) {
  const [tab, setTab] = useState<Tab>('live');
  return (
    <section
      aria-label="Preview"
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-xl border border-border-subtle bg-neutral-100 shadow-card',
        className,
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-5 pb-1 pt-4">
        <SegmentedControl
          label="Preview mode"
          value={tab}
          onChange={setTab}
          segments={[
            {
              id: 'live',
              label: 'Live preview',
              title: 'Updates as you type · dashed lines mark page ends',
            },
            { id: 'pdf', label: 'PDF pages', title: 'Exactly what Download PDF gives you' },
          ]}
        />
        {toolbar && <div className="ml-auto">{toolbar}</div>}
      </div>
      {tab === 'live' ? (
        <LivePage doc={doc} />
      ) : (
        <PdfPages resumeId={doc.resumeId} versionId={doc.versionId} saving={saving} />
      )}
    </section>
  );
}
